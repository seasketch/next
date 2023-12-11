import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import ArcGISSearchPage from "./ArcGISSearchPage";
import {
  CatalogItem,
  NormalizedArcGISServerLocation,
  generateStableId,
  useCatalogItemDetails,
  useCatalogItems,
} from "./arcgis";
import { AnyLayer, LngLatBounds, LngLatBoundsLike, Map } from "mapbox-gl";
import { SearchIcon } from "@heroicons/react/outline";
import Skeleton from "../../../components/Skeleton";
import {
  ActivityLogIcon,
  ArrowLeftIcon,
  CheckCircledIcon,
  ExternalLinkIcon,
} from "@radix-ui/react-icons";
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
import {
  ArcgisFeatureLayerFetchStrategy,
  ArcgisImportItemInput,
  ArcgisImportSourceInput,
  ArcgisSourceType,
  BasemapType,
  DraftTableOfContentsDocument,
  GetBasemapsDocument,
  useCreateBasemapMutation,
  useImportArcGisServiceMutation,
} from "../../../generated/graphql";
import ReactDOM from "react-dom";
import {
  MotionValue,
  motion,
  useMotionValue,
  useTransform,
} from "framer-motion";

const requestManager = new ArcGISRESTServiceRequestManager();

const FEATURE_LAYERS_DEFAULT_VISIBLE_LAYERS_LIMIT = 3;

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

  const [importMutation, importState] = useImportArcGisServiceMutation();

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
  }, [customSources, map, setSourceLoading, hiddenLayers]);

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
          const layerStaticIdsToHide: string[] = [];
          let defaultVisibleLayers = featureLayers
            .filter((item) => item.defaultVisibility === true)
            .map((item) => item.id);
          if (
            defaultVisibleLayers.length >
            FEATURE_LAYERS_DEFAULT_VISIBLE_LAYERS_LIMIT
          ) {
            defaultVisibleLayers = defaultVisibleLayers
              .reverse()
              .slice(0, FEATURE_LAYERS_DEFAULT_VISIBLE_LAYERS_LIMIT);
          }
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
              if (!defaultVisibleLayers.includes(layer.id)) {
                for (const item of tableOfContentsItems) {
                  layerStaticIdsToHide.push(item.id);
                }
                featureLayerSource.updateLayers([]);
              } else {
                featureLayerSource.updateLayers([
                  {
                    id: layer.id.toString(),
                    opacity: 1,
                  },
                ]);
              }
              setTableOfContentsItems((prev) => [
                ...prev,
                ...tableOfContentsItems,
              ]);
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
          setHiddenLayers(layerStaticIdsToHide);

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

  const { loadingMessage, confirm, alert, makeChoice } = useDialog();

  const [createBasemap, createBaseMapState] = useCreateBasemapMutation();

  const selectionAlreadyAdded =
    selection && importedArcGISServices.includes(selection.url);

  const onAddService = useCallback(async () => {
    if (importedArcGISServices.includes(selection?.url || "")) {
      const answer = await confirm(
        t(
          "This service has already been added to your project's table of contents. Are you sure you want to import it again?"
        )
      );
      if (!answer) {
        return;
      } else {
        // I don't know why this fixes modal contention problems but I'm not
        // going to waste time figuring it out
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
    const { hideLoadingMessage, updateLoadingMessage } = loadingMessage(
      t(`Evaluating services (1/${customSources.length})...`)
    );
    const layers = catalogItemDetailsQuery.data?.metadata.layers || [];
    if (layers.length && customSources.length) {
      const items: ArcgisImportItemInput[] = [];
      const sources: ArcgisImportSourceInput[] = [];
      if (customSources[0].type === "ArcGISTiledMapService") {
        let thumbnail: string = "";
        try {
          thumbnail = await (
            customSources[0] as ArcGISTiledMapService
          ).getThumbnailForCurrentExtent();
        } catch (e) {
          alert(
            t("Error importing service. Could not generate thumbnail image"),
            {
              description: e.message,
            }
          );
          return;
        }
        const choice = await makeChoice({
          title: t("Import this tiled service as a..."),
          choices: [
            <div className="flex w-full items-center md:min-w-lg border rounded-lg p-4 group-hover:border-blue-500 group-hover:bg-blue-50 bg-opacity-30">
              <img
                src={thumbnail}
                alt="Basemap thumbnail"
                className="w-16 h-16 mr-3 rounded border border-gray-300"
              />
              <div className="flex-1">
                <h3 className="font-semibold">{t("Basemap")}</h3>
                <p className="text-sm">
                  {t(
                    "Map tiles will be displayed below all overlay layers, and the basemap is accessible from the Maps tab."
                  )}
                </p>
              </div>
            </div>,
            <div className="flex w-full items-center md:min-w-lg border rounded-lg p-4 group-hover:border-blue-500 group-hover:bg-blue-50 bg-opacity-30">
              <div className="flex items-center justify-center w-16 h-16 rounded bg-gray-100 mr-3 border border-gray-300">
                <ActivityLogIcon className="w-8 h-8 text-gray-700" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{t("Overlay Layer")}</h3>
                <p className="text-sm">
                  {t(
                    "Use this option if you would like to display these map tiles over an existing basemap. Best for tiled layers with alpha transparency."
                  )}
                </p>
              </div>
            </div>,
          ],
        });
        if (choice === false) {
          return;
        } else if (choice === 0) {
          try {
            updateLoadingMessage(t("Creating thumbnail..."));
            const response = await fetch(thumbnail);
            const blob = await response.blob();
            updateLoadingMessage(t("Creating basemap..."));
            const basemapResponse = await createBasemap({
              variables: {
                projectId,
                name: (selection?.name || "Imported ArcGIS Service").replace(
                  /_/g,
                  " "
                ),
                // eslint-disable-next-line i18next/no-literal-string
                url: customSources[0].url + `/tile/{z}/{y}/{x}`,
                type: BasemapType.RasterUrlTemplate,
                isArcgisTiledMapservice: true,
                tileSize: 256,
                surveysOnly: false,
                thumbnail: blob,
              },
              refetchQueries: [
                DraftTableOfContentsDocument,
                GetBasemapsDocument,
              ],
            });
            // load thumbnail as soon as saved to prevent flicker
            const url = basemapResponse.data?.createBasemap?.basemap?.thumbnail;
            if (url) {
              fetch(url);
            }
            hideLoadingMessage();
            return;
          } catch (e) {
            hideLoadingMessage();
            alert(t("Error importing service"), {
              description: e.message,
            });
          }
        } else {
          items.push({
            title: selection?.name,
            isFolder: false,
            id: 1,
            sourceId: 1,
            stableId: generateStableId(),
          });
          sources.push({
            id: 1,
            type: ArcgisSourceType.ArcgisRasterTiles,
            url: customSources[0].url,
          });
        }
      } else {
        let importedCount = 0;
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
                ? { parentId: layer.parentLayerId.toString() }
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
            updateLoadingMessage(
              t(
                `Evaluating services (${importedCount++}/${
                  customSources.length
                })...`
              )
            );

            items.push({
              id: layer.id,
              isFolder: false,
              title:
                catalogItemDetailsQuery.data?.type === "FeatureServer" &&
                layers.length === 1
                  ? selection?.name || layer.name
                  : layer.name,
              sourceId: layer.id,
              ...("parentLayerId" in layer && layer.parentLayerId > -1
                ? { parentId: layer.parentLayerId.toString() }
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
                ? { parentId: layer.parentLayerId.toString() }
                : {}),
              sublayerId: layer.id,
              stableId: generateStableId(),
            });
          }
        }
      }
      if (
        catalogItemDetailsQuery.data?.type === "MapServer" &&
        !useFeatureLayers &&
        !catalogItemDetailsQuery.data?.tiled
      ) {
        sources.push({
          id: 1,
          type: ArcgisSourceType.ArcgisDynamicMapserver,
          url: selection?.url,
        });
      }

      if (items.length > 1) {
        // Stick everything in an enclosing folder
        const enclosingFolder: ArcgisImportItemInput = {
          id: 9999999,
          isFolder: true,
          stableId: generateStableId(),
          title: selection?.name || "Imported ArcGIS Service",
        };
        for (const item of items) {
          if (item.parentId === undefined) {
            // @ts-ignore
            item.parentId = enclosingFolder.id;
          }
        }
        items.push(enclosingFolder);
      }

      // replace parentIds with stableIds
      for (const item of items) {
        if (item.parentId) {
          const parentId = items.find(
            (i) => i.id?.toString() === item.parentId?.toString()
          )?.stableId;
          item.parentId = parentId;
        }
      }

      // eslint-disable-next-line i18next/no-literal-string
      updateLoadingMessage(`Adding ${items.length} items to project...`);
      try {
        await importMutation({
          variables: {
            projectId,
            items,
            sources,
          },
          refetchQueries: [DraftTableOfContentsDocument],
        });
        updateLoadingMessage(
          <div className="flex items-center space-x-2">
            <div>{t("Service imported")}</div>
            <FinishedImportAnimation
              onAnimationComplete={() => {
                setTimeout(() => {
                  hideLoadingMessage();
                }, 500);
              }}
            />
          </div>,
          true
        );
      } catch (e) {
        console.error(e);
        hideLoadingMessage();
        alert(t("Error importing service"), {
          description: e.message,
        });
      }
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
    importedArcGISServices,
    alert,
    confirm,
    createBasemap,
    makeChoice,
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
                if (result.selectedFolder) {
                  setSelectedFolder(result.selectedFolder);
                }
                if (result.catalogItem) {
                  setSelection(result.catalogItem);
                }
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
                        <h2 className="truncate">
                          <span>{item.name}</span>
                        </h2>

                        {selection?.url === item.url ? (
                          <>
                            {importedArcGISServices.includes(item.url) && (
                              <span className=" rounded-lg px-2 py-0.5 mr-2 text-sm bg-blue-100 text-black">
                                <CheckCircledIcon className="inline mr-1" />
                                <span>{t("Imported")}</span>
                              </span>
                            )}

                            <a
                              className="text-sm underline"
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {item.type}
                              <ExternalLinkIcon className="inline ml-1" />
                            </a>
                          </>
                        ) : (
                          <span className="text-sm">
                            {importedArcGISServices.includes(item.url) && (
                              <span className="bg-blue-100 rounded-lg px-2 py-0.5 mr-2">
                                <CheckCircledIcon className="inline mr-1" />
                                <span>{t("Imported")}</span>
                              </span>
                            )}
                            {item.type}
                          </span>
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
                  catalogItemDetailsQuery.data?.type === "MapServer" &&
                  !catalogItemDetailsQuery.data?.tiled
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
                      Best option for smaller services, can cause problems for
                      larger ones.
                    </Trans>
                  </p>
                </div>
                <Switch
                  isToggled={useFeatureLayers}
                  onClick={(val) => {
                    setUseFeatureLayers(val);
                  }}
                />
              </div>
              <div className="flex items-center space-x-1 h-full">
                <Button label={t("Close")} onClick={onRequestClose} />
                {Boolean(selection) && (
                  <Button
                    onClick={onAddService}
                    primary={!selectionAlreadyAdded}
                    label={
                      selectionAlreadyAdded
                        ? t("Import service again")
                        : t("Add service to project")
                    }
                  />
                )}
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

function CircularProgress({ progress }: { progress: MotionValue<number> }) {
  const circleLength = useTransform(progress, [0, 100], [0, 1]);
  const checkmarkPathLength = useTransform(progress, [0, 95, 100], [0, 0, 1]);
  const circleColor = useTransform(
    progress,
    [0, 95, 100],
    ["#FFCC66", "#FFCC66", "#66BB66"]
  );

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-8 h-8"
      viewBox="0 0 258 258"
    >
      {/* Check mark  */}
      <motion.path
        transform="translate(60 85)"
        d="M3 50L45 92L134 3"
        fill="transparent"
        stroke="#7BB86F"
        strokeWidth={8}
        style={{ pathLength: checkmarkPathLength }}
      />
      {/* Circle */}
      <motion.path
        d="M 130 6 C 198.483 6 254 61.517 254 130 C 254 198.483 198.483 254 130 254 C 61.517 254 6 198.483 6 130 C 6 61.517 61.517 6 130 6 Z"
        fill="transparent"
        strokeWidth="8"
        stroke={circleColor}
        style={{
          pathLength: circleLength,
        }}
      />
    </motion.svg>
  );
}

function FinishedImportAnimation({
  onAnimationComplete,
}: {
  onAnimationComplete: () => void;
}) {
  let progress = useMotionValue(90);
  return (
    <div className="inline-flex align-center">
      <motion.div
        initial={{ x: 0 }}
        animate={{ x: 100 }}
        style={{ x: progress }}
        transition={{ duration: 1 }}
        onAnimationComplete={onAnimationComplete}
      />
      <CircularProgress progress={progress} />
    </div>
  );
}
