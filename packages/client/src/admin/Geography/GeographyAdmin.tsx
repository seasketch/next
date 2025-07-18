import {
  EnterFullScreenIcon,
  FileTextIcon,
  Pencil1Icon,
  Pencil2Icon,
  PlusCircledIcon,
  CaretDownIcon,
} from "@radix-ui/react-icons";
import { Trans, useTranslation } from "react-i18next";
import {
  DataSourceTypes,
  SketchGeometryType,
  useGeographyClippingSettingsQuery,
} from "../../generated/graphql";
import Spinner from "../../components/Spinner";
import Warning from "../../components/Warning";
import { useEffect, useMemo, useRef, useState } from "react";
import getSlug from "../../getSlug";
import mapboxgl from "mapbox-gl";
import useEEZChoices from "./useEEZChoices";
import Button from "../../components/Button";
import useMapboxGLDraw, {
  DigitizingState,
  EMPTY_FEATURE_COLLECTION,
} from "../../draw/useMapboxGLDraw";
import { Feature } from "geojson";
import DigitizingTools from "../../formElements/DigitizingTools";
import CreateGeographyWizard from "./CreateGeographyWizard";
import VisibilityCheckbox from "../../dataLayers/tableOfContents/VisibilityCheckbox";
import EditGeographyModal from "./EditGeographyModal";
import deepEqual from "fast-deep-equal";

const EEZ = "MARINE_REGIONS_EEZ_LAND_JOINED";
const COASTLINE = "DAYLIGHT_COASTLINE";
const HIGH_SEAS = "MARINE_REGIONS_HIGH_SEAS";
const TERRITORIAL_SEA = "MARINE_REGIONS_TERRITORIAL_SEA";

const SOURCE_ID_PREFIX = "source-";
const LAYER_ID_PREFIX = "layer-";
const JSON_EXTENSION = ".json";
const GOOGLE_MAPS_TILE_URL =
  "https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}";

type AdminState = {
  mapLoaded: boolean;
  map: mapboxgl.Map | null;
  hiddenGeographies: number[];
  editGeographyId?: number;
  wizardActive: boolean;
  sidebarVisible: boolean;
  showLayerChoice: boolean;
  selectedGeographyId?: number;
  showGeographyDropdown: boolean;
};

const ensureGeographyVisibleAndInView = (
  geographyId: number,
  map: mapboxgl.Map | null,
  hiddenGeographies: number[],
  onToggleVisibility: (id: number) => void,
  geographies: any[]
) => {
  // Make sure geography is visible
  if (hiddenGeographies.includes(geographyId)) {
    onToggleVisibility(geographyId);
  }

  // Check if we need to adjust the map view
  if (map) {
    const geography = geographies.find((g) => g.id === geographyId);
    if (geography?.bounds) {
      const currentBounds = map.getBounds();
      const geographyBounds = new mapboxgl.LngLatBounds(
        [geography.bounds[0], geography.bounds[1]],
        [geography.bounds[2], geography.bounds[3]]
      );

      // Check if the geography bounds are completely outside the current view
      const currentNE = currentBounds.getNorthEast();
      const currentSW = currentBounds.getSouthWest();
      const geographyNE = geographyBounds.getNorthEast();
      const geographySW = geographyBounds.getSouthWest();

      // Check if the bounding boxes don't overlap at all
      if (
        currentNE.lng < geographySW.lng ||
        currentSW.lng > geographyNE.lng ||
        currentNE.lat < geographySW.lat ||
        currentSW.lat > geographyNE.lat
      ) {
        map.fitBounds(geography.bounds as [number, number, number, number], {
          padding: 50,
          animate: true,
        });
      }
    }
  }
};

export default function GeographyAdmin() {
  const { t } = useTranslation("admin:geography");
  const slug = getSlug();
  const { data, loading, error } = useGeographyClippingSettingsQuery({
    variables: { slug },
    skip: !slug,
  });

  const [state, setState] = useState<AdminState>({
    mapLoaded: false,
    map: null,
    hiddenGeographies: [],
    wizardActive: false,
    sidebarVisible: true,
    showLayerChoice: false,
    showGeographyDropdown: false,
  });

  const coastline = data?.geographyClippingLayers?.find(
    (l) => l.dataSource?.dataLibraryTemplateId === COASTLINE
  );

  const eez = data?.geographyClippingLayers?.find(
    (l) => l.dataSource?.dataLibraryTemplateId === EEZ
  );

  const territorialSea = data?.geographyClippingLayers?.find(
    (l) => l.dataSource?.dataLibraryTemplateId === TERRITORIAL_SEA
  );

  const hasBuiltInLayers =
    Boolean(coastline) && Boolean(eez) && Boolean(territorialSea);

  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);

  // Handle visibility checkbox toggle
  const handleGeographyVisibilityToggle = (geogId: number) => {
    setState((prev) => {
      const newHiddenGeographies = prev.hiddenGeographies.includes(geogId)
        ? prev.hiddenGeographies.filter((id) => id !== geogId)
        : [...prev.hiddenGeographies, geogId];

      // Update layer visibility directly if map is available
      if (prev.map) {
        const isVisible = !newHiddenGeographies.includes(geogId);
        // Find all layers associated with this geography
        const layers = prev.map.getStyle().layers || [];
        for (const layer of layers) {
          const metadata = (layer as any).metadata;
          if (metadata?.geographyId === geogId) {
            prev.map.setLayoutProperty(
              layer.id,
              "visibility",
              isVisible ? "visible" : "none"
            );
          }
        }
      }

      return { ...prev, hiddenGeographies: newHiddenGeographies };
    });
  };

  const handleToggleSidebar = (show: boolean) => {
    setState((prev) => {
      // Only update if the value is actually changing
      if (prev.sidebarVisible === show) {
        return prev;
      }
      return { ...prev, sidebarVisible: show };
    });
  };

  // Handle map resize when sidebar visibility changes
  useEffect(() => {
    if (state.map) {
      // Small delay to allow DOM to update
      setTimeout(() => {
        state.map?.resize();
      }, 100);
    }
  }, [state.sidebarVisible, state.map]);

  // Handle sidebar visibility based on layer choice state
  useEffect(() => {
    handleToggleSidebar(!state.showLayerChoice);
  }, [state.showLayerChoice]);

  useEffect(() => {
    if (
      !map &&
      mapRef.current &&
      data?.gmapssatellitesession?.session &&
      eez?.dataSource?.url &&
      coastline?.dataSource?.url &&
      territorialSea?.dataSource?.url
    ) {
      let bbox: number[] | undefined;
      const bounds = (data?.projectBySlug?.geographies || [])
        .map((geog) => geog.bounds)
        .filter((b) => Boolean(b)) as [number, number, number, number][];
      if (bounds.length > 0) {
        bbox = combineBBoxes(bounds);
      }
      const session = data.gmapssatellitesession.session;
      const newMap = new mapboxgl.Map({
        container: mapRef.current,
        style: {
          version: 8,
          sources: {
            satellite: {
              type: "raster",
              tiles: [
                // eslint-disable-next-line i18next/no-literal-string
                `${GOOGLE_MAPS_TILE_URL}?session=${session}&key=${process.env.REACT_APP_GOOGLE_MAPS_2D_TILE_API_KEY}`,
              ],
              format: "jpeg",
              attribution: "Google",
              tileSize: 512,
            },
          },
          layers: [
            {
              id: "satellite-layer",
              type: "raster",
              source: "satellite",
              minzoom: 0,
              maxzoom: 22,
            },
          ],
        },
        ...(bbox
          ? {
              bounds: [
                [bbox[0], bbox[1]],
                [bbox[2], bbox[3]],
              ],
              fitBoundsOptions: { padding: 80 },
            }
          : { center: [-119.7145, 34.4208], zoom: 3 }),
        // @ts-ignore
        projection: "globe",
      });

      newMap.on("load", () => {
        setMap(newMap);
        newMap.setFog({
          range: [1, 5],
          color: "rgba(255, 255, 255, 0.4)",
          "horizon-blend": 0.1,
          "high-color": "rgba(55, 120, 255, 0.5)",
          "space-color": "rgba(0, 0, 0, 1)",
          "star-intensity": 0.5,
        });

        setState((prev) => ({ ...prev, mapLoaded: true, map: newMap }));
      });
    }
  }, [
    mapRef,
    data?.gmapssatellitesession?.session,
    eez?.dataSource?.url,
    coastline?.dataSource?.url,
    territorialSea?.dataSource?.url,
    setState,
  ]);

  useEffect(() => {
    if (
      state.mapLoaded &&
      data?.geographies &&
      state.map &&
      !state.wizardActive
    ) {
      const map = state.map;

      // Reset all layers except basemap
      const resetLayers = () => {
        const styleLayers = map.getStyle().layers || [];
        const sources = new Set<string>();

        // Remove all layers except satellite layer
        for (const layer of styleLayers) {
          if (layer.id !== "satellite-layer") {
            map.removeLayer(layer.id);
            // Track sources to potentially remove
            const sourceId = (layer as any).source;
            if (sourceId) {
              sources.add(sourceId);
            }
          }
        }

        // Remove unused sources
        for (const sourceId of sources) {
          if (map.getSource(sourceId)) {
            map.removeSource(sourceId);
          }
        }
      };

      // Reset layers
      resetLayers();

      // Add geography data sources and layers
      const sources: { [id: string]: mapboxgl.AnySourceData } = {};
      const hiddenGeogIds = state.hiddenGeographies;
      const layers: mapboxgl.AnyLayer[] = [];
      const customLayerGeographies: { [key: string]: any[] } = {};

      // Collect all sources and layers
      for (const geography of data.projectBySlug?.geographies || []) {
        if (hiddenGeogIds.includes(geography.id)) continue;
        for (const layer of geography.clippingLayers || []) {
          if (layer.dataSource) {
            const sourceId = SOURCE_ID_PREFIX + layer.dataSource.id;
            if (!(sourceId in sources)) {
              if (layer.dataSource.type === DataSourceTypes.SeasketchMvt) {
                sources[sourceId] = {
                  type: "vector",
                  url: layer.dataSource.url! + JSON_EXTENSION,
                };
              } else if (layer.dataSource.type === DataSourceTypes.Geojson) {
                sources[sourceId] = {
                  type: "geojson",
                  data: layer.dataSource.url!,
                };
              } else {
                throw new Error(
                  `Unsupported data source type: ${layer.dataSource.type}`
                );
              }
            }

            // Check if this is a custom layer (no templateId)
            if (!layer.templateId) {
              if (!customLayerGeographies[sourceId]) {
                customLayerGeographies[sourceId] = [];
              }
              customLayerGeographies[sourceId].push({ geography, layer });
            } else {
              if (layer.dataLayer?.mapboxGlStyles?.length) {
                const hasMatches = layers.some(
                  (existingLayer: any) =>
                    existingLayer.metadata?.layerId === layer.dataLayer?.id
                );
                if (!hasMatches) {
                  for (const glLayer of layer.dataLayer.mapboxGlStyles) {
                    const layerId =
                      LAYER_ID_PREFIX +
                      layer.dataLayer.id +
                      "-" +
                      layer.dataLayer.mapboxGlStyles.indexOf(glLayer);
                    layers.push({
                      ...glLayer,
                      source: sourceId,
                      "source-layer": layer.dataLayer.sourceLayer,
                      id: layerId,
                      metadata: {
                        layerId: layer.dataLayer.id,
                        isGeographyLayer: true,
                      },
                    } as any);
                  }
                }
              }
            }
          }
        }
      }

      // Add all sources
      for (const [id, source] of Object.entries(sources)) {
        map.addSource(id, source);
      }

      // Add all non-custom layers
      for (const layer of layers) {
        map.addLayer(layer as any);
      }

      // Add custom layers with filters
      for (const [sourceId, geographies] of Object.entries(
        customLayerGeographies
      )) {
        for (const { geography, layer } of geographies) {
          if (layer.dataLayer?.mapboxGlStyles?.length) {
            for (const glLayer of layer.dataLayer.mapboxGlStyles) {
              const layerId = `${LAYER_ID_PREFIX}${layer.dataLayer.id}-${
                geography.id
              }-${layer.dataLayer.mapboxGlStyles.indexOf(glLayer)}`;

              // Convert CQL2 query to Mapbox GL filter
              let filter: any[] | undefined;
              if (layer.cql2Query) {
                try {
                  const cql2 = layer.cql2Query;
                  if (cql2.op === "=") {
                    filter = [
                      "==",
                      ["get", cql2.args[0].property],
                      cql2.args[1],
                    ];
                  } else if (cql2.op === "in") {
                    filter = [
                      "in",
                      ["get", cql2.args[0].property],
                      ["literal", cql2.args[1]],
                    ];
                  }
                } catch (e) {
                  console.error("Error parsing CQL2 query:", e);
                }
              }

              map.addLayer({
                ...glLayer,
                source: sourceId,
                "source-layer": layer.dataLayer.sourceLayer,
                id: layerId,
                ...(filter ? { filter } : {}),
                layout: {
                  ...glLayer.layout,
                  visibility: hiddenGeogIds.includes(geography.id)
                    ? "none"
                    : "visible",
                },
                metadata: {
                  isGeographyLayer: true,
                  layerId: layer.dataLayer.id,
                  geographyId: geography.id,
                },
              } as any);
            }
          }
        }
      }
    }
  }, [
    data?.projectBySlug?.geographies,
    state.mapLoaded,
    state.map,
    state.hiddenGeographies,
    state.wizardActive,
  ]);

  const usedTemplates = useMemo(() => {
    if (!data?.projectBySlug?.geographies) return [];
    return Array.from(
      new Set(
        data.projectBySlug.geographies
          .map((geog) => geog.clientTemplate)
          .filter(Boolean) as string[]
      )
    );
  }, [data?.projectBySlug?.geographies]);

  const mapContext = useMemo(() => {
    return {
      manager: {
        map: map || undefined,
        requestDigitizingLock: () => {},
        releaseDigitizingLock: () => {},
      },
    };
  }, [map]);

  const [drawFeature, setDrawFeature] = useState<Feature | null>(null);

  const extraRequestParams = useMemo(() => {
    const geographies = [];
    // Only include the selected geography for clipping
    const selectedGeography = data?.projectBySlug?.geographies?.find(
      (geog) => geog.id === state.selectedGeographyId
    );
    if (selectedGeography) {
      const clippingLayers = [];
      if (selectedGeography.clippingLayers) {
        for (const layer of selectedGeography.clippingLayers) {
          if (!layer.dataLayer?.vectorObjectKey) {
            throw new Error("Vector object key is required");
          }
          if (layer.objectKey) {
            clippingLayers.push({
              id: layer.id,
              cql2Query: layer.cql2Query,
              op: layer.operationType,
              dataset: layer.dataLayer.vectorObjectKey,
              templateId: layer.templateId,
            });
          }
        }
      }
      geographies.push({
        name: selectedGeography.name,
        id: selectedGeography.id,
        clippingLayers,
      });
    }
    return {
      geographies,
    };
  }, [data?.projectBySlug?.geographies, state.selectedGeographyId]);

  const draw = useMapboxGLDraw(
    mapContext,
    SketchGeometryType.Polygon,
    EMPTY_FEATURE_COLLECTION,
    (feature) => {
      setDrawFeature(feature);
    },
    undefined,
    // "https://overlay.seasketch.org/geographies/clip",
    "https://sketch-preprocessing-worker.underbluewaters.workers.dev/clip",
    // "https://h13gfvr460.execute-api.us-west-2.amazonaws.com/prod/eraseLand",
    (geom, performance) => {
      // console.log("geom", geom, performance);
    },
    extraRequestParams,
    (feature) => {
      if (feature.geometry.coordinates[0].length > 3) {
        fetch(
          "https://sketch-preprocessing-worker.underbluewaters.workers.dev/warm-cache",
          {
            method: "POST",
            body: JSON.stringify({
              ...extraRequestParams,
              feature,
            }),
            headers: {
              "Content-Type": "application/json",
            },
          }
        ).catch((err) => {
          console.error("err", err);
        });
      }
    }
  );

  const unrepresentedTerritorialSeas = useMemo(() => {
    const mrgidEEZs: Set<number> = new Set();
    for (const geog of data?.projectBySlug?.geographies || []) {
      const eezLayer = geog.clippingLayers?.find(
        (l) => l.dataSource?.dataLibraryTemplateId === EEZ
      );
      const cql = eezLayer?.cql2Query;
      if (isOp(cql, "=") && hasArg(cql, 0, { property: "MRGID_EEZ" })) {
        mrgidEEZs.add(getArg(cql, 1));
      } else if (isOp(cql, "in") && hasArg(cql, 0, { property: "MRGID_EEZ" })) {
        const ids = getArg(cql, 1);
        if (Array.isArray(ids)) {
          for (const id of ids) {
            mrgidEEZs.add(id);
          }
        }
      }
    }
    // then, remove EEZs that already have a territorial sea geography
    for (const geog of data?.projectBySlug?.geographies || []) {
      const territorialSeaLayer = geog.clippingLayers?.find(
        (l) => l.dataSource?.dataLibraryTemplateId === TERRITORIAL_SEA
      );
      if (territorialSeaLayer) {
        const cql = territorialSeaLayer.cql2Query;
        if (isOp(cql, "=") && hasArg(cql, 0, { property: "MRGID_EEZ" })) {
          mrgidEEZs.delete(getArg(cql, 1));
        } else if (
          isOp(cql, "in") &&
          hasArg(cql, 0, { property: "MRGID_EEZ" })
        ) {
          const ids = getArg(cql, 1);
          if (Array.isArray(ids)) {
            for (const id of ids) {
              mrgidEEZs.delete(id);
            }
          }
        }
      }
    }

    return [...mrgidEEZs];
  }, [data?.projectBySlug?.geographies]);

  return (
    <div className="w-full h-full flex">
      {state.sidebarVisible && (
        <nav className="w-96 bg-white h-full overflow-y-auto border-r border-black border-opacity-10 flex flex-col">
          <h1 className="p-4 font-semibold">
            <Trans ns="admin:geograpy">Geography</Trans>
          </h1>
          <p className="px-4 text-sm">
            <Trans ns="admin:geography">
              Geographies represent spatial areas where sketches can be drawn
              and define regions where you would like to aggregate metrics for
              reporting. Your project can use built-in land and eez layers to
              start with, and add custom boundary layers if needed.
            </Trans>
          </p>
          <p className="text-sm p-4">
            <a href="" className="flex items-center space-x-1 text-primary-500">
              <FileTextIcon />
              <span>
                <Trans ns="admin:geography">
                  Read the geography documentation
                </Trans>
              </span>
            </a>
          </p>
          <div className="flex flex-col overflow-y-auto bg-gray-200 h-full shadow-inner">
            {loading && (
              <div className="w-full text-center p-5">
                <Spinner />
              </div>
            )}
            {!hasBuiltInLayers && !loading && (
              <Warning level="error">
                {error ? (
                  error.toString()
                ) : (
                  <Trans ns="admin:geography">
                    SeaSketch has not been configured correctly with {EEZ},{" "}
                    {TERRITORIAL_SEA} and {COASTLINE} layers. Contact{" "}
                    <a
                      className="underline"
                      href="mailto:support@seasketch.org"
                    >
                      support@seasketch.org
                    </a>{" "}
                    for assistance. Documentation on updating template layers is
                    online at{" "}
                    <a href="https://github.com/seasketch/next/wiki/Data-Library#assigning-data-library-template-ids">
                      https://github.com/seasketch/next/wiki/Data-Library#assigning-data-library-template-ids
                    </a>
                  </Trans>
                )}
              </Warning>
            )}
            {!loading && (
              <ul className="w-full p-2 py-4 space-y-2">
                {data?.projectBySlug?.geographies?.map((geog) => (
                  <li
                    className="bg-white rounded p-4 shadow-sm flex items-center space-x-2"
                    key={geog.id}
                  >
                    <VisibilityCheckbox
                      disabled={false}
                      visibility={!state.hiddenGeographies.includes(geog.id)}
                      id={geog.id}
                      onClick={() => handleGeographyVisibilityToggle(geog.id)}
                    />
                    <span className="flex-1">{geog.name}</span>
                    <span className="space-x-2 flex items-center">
                      <button
                        disabled={!geog.bounds}
                        className="disabled:opacity-20"
                        onClick={() => {
                          if (geog.bounds) {
                            map?.fitBounds(
                              geog.bounds as [number, number, number, number],
                              {
                                padding: 10,
                                animate: true,
                              }
                            );
                          }
                        }}
                      >
                        <EnterFullScreenIcon />
                      </button>
                      <button
                        onClick={() => {
                          setState((prev) => ({
                            ...prev,
                            editGeographyId: geog.id,
                          }));
                        }}
                      >
                        {" "}
                        <Pencil2Icon />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {!loading && (
              <div className="px-2 -mt-1">
                <button
                  onClick={() => {
                    setState((prev) => ({
                      ...prev,
                      wizardActive: true,
                    }));
                  }}
                  className="border border-indigo-800/20 rounded w-full text-left flex flex-row-reverse items-center space-x-2 p-4 px-2 pr-4 text-blue-900/80 bg-blue-50/70 shadow-sm hover:bg-blue-50 hover:shadow-md hover:text-blue-900 transition-all"
                >
                  <PlusCircledIcon />
                  <span className="flex-1">
                    {(data?.projectBySlug?.geographies || []).length === 0
                      ? t("Create Your First Geography")
                      : t("Create a New Geography")}
                  </span>
                </button>
              </div>
            )}
          </div>
        </nav>
      )}
      <div
        ref={mapRef}
        className={`flex-1 relative ${!state.sidebarVisible ? "w-full" : ""}`}
      >
        {map &&
          !state.wizardActive &&
          data?.projectBySlug?.geographies?.length && (
            <div className="absolute top-0 left-0 p-3 flex items-center space-x-2 z-10">
              {!state.selectedGeographyId ? (
                <select
                  className="form-select rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 text-sm"
                  value={state.selectedGeographyId || ""}
                  onChange={(e) => {
                    const id = parseInt(e.target.value);
                    if (id) {
                      setState((prev) => ({
                        ...prev,
                        selectedGeographyId: id,
                      }));
                      ensureGeographyVisibleAndInView(
                        id,
                        state.map,
                        state.hiddenGeographies,
                        handleGeographyVisibilityToggle,
                        data?.projectBySlug?.geographies || []
                      );
                      draw.setCollection(EMPTY_FEATURE_COLLECTION);
                      setTimeout(() => {
                        draw.create(false, true);
                      }, 0);
                    }
                  }}
                >
                  <option value="">{t("Draw within a Geography...")}</option>
                  {data.projectBySlug.geographies.map((geog) => (
                    <option key={geog.id} value={geog.id}>
                      {geog.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="relative inline-flex">
                  <div className="group relative inline-flex items-center rounded-md bg-white text-sm font-medium shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
                    <button
                      type="button"
                      className="flex items-center space-x-2 px-1.5 py-1"
                      onClick={() => {
                        draw.setCollection(EMPTY_FEATURE_COLLECTION);
                        setTimeout(() => {
                          draw.create(false, true);
                        }, 0);
                      }}
                    >
                      <Pencil1Icon className="h-4 w-4" />
                      <span>
                        {t("Draw Polygon - ")}
                        {
                          data.projectBySlug.geographies.find(
                            (g) => g.id === state.selectedGeographyId
                          )?.name
                        }
                      </span>
                    </button>
                    <div className="relative">
                      <div className="h-full w-px bg-gray-300" />
                    </div>
                    <button
                      type="button"
                      className="px-2 hover:bg-gray-100 rounded-r-md h-full border-l border-black/90"
                      onClick={() =>
                        setState((prev) => ({
                          ...prev,
                          showGeographyDropdown: !prev.showGeographyDropdown,
                        }))
                      }
                    >
                      <CaretDownIcon className="h-4 w-4" />
                    </button>
                  </div>
                  {state.showGeographyDropdown && (
                    <div className="absolute right-0 top-full mt-1 w-56 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-50 focus:outline-none">
                      <div className="py-1" role="menu">
                        {data.projectBySlug.geographies.map((geog) => (
                          <button
                            key={geog.id}
                            className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                              geog.id === state.selectedGeographyId
                                ? "bg-gray-50 text-blue-600"
                                : "text-gray-700"
                            }`}
                            onClick={() => {
                              setState((prev) => ({
                                ...prev,
                                selectedGeographyId: geog.id,
                                showGeographyDropdown: false,
                              }));
                              ensureGeographyVisibleAndInView(
                                geog.id,
                                state.map,
                                state.hiddenGeographies,
                                handleGeographyVisibilityToggle,
                                data?.projectBySlug?.geographies || []
                              );
                              draw.setCollection(EMPTY_FEATURE_COLLECTION);
                              setTimeout(() => {
                                draw.create(false, true);
                              }, 0);
                            }}
                          >
                            {geog.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {(drawFeature ||
                (draw.digitizingState !== DigitizingState.DISABLED &&
                  draw.digitizingState !== DigitizingState.NO_SELECTION)) && (
                <Button
                  small
                  buttonClassName=""
                  label={t("Clear")}
                  onClick={() => {
                    setDrawFeature(null);
                    draw.setCollection(EMPTY_FEATURE_COLLECTION);
                  }}
                >
                  <span className="flex items-center space-x-1">
                    <span>{t("Clear")}</span>
                  </span>
                </Button>
              )}
            </div>
          )}
        {(drawFeature ||
          (draw.digitizingState !== DigitizingState.DISABLED &&
            draw.digitizingState !== DigitizingState.NO_SELECTION)) && (
          <div className="absolute w-full h-10 bottom-4 flex items-center justify-center">
            <DigitizingTools
              className="!-bottom-2"
              preprocessingError={draw.preprocessingError || undefined}
              multiFeature={false}
              isSketchingWorkflow={true}
              selfIntersects={draw.selfIntersects}
              onRequestResetFeature={() => {
                draw.setCollection(EMPTY_FEATURE_COLLECTION);
                draw.create(false, true);
              }}
              onRequestFinishEditing={draw.actions.finishEditing}
              geometryType={SketchGeometryType.Polygon}
              state={draw.digitizingState}
              onRequestSubmit={() => {}}
              onRequestDelete={() => {
                draw.setCollection(EMPTY_FEATURE_COLLECTION);
                setDrawFeature(null);
              }}
              onRequestEdit={draw.actions.edit}
              performance={
                draw.digitizingState === DigitizingState.NO_SELECTION &&
                drawFeature
                  ? draw.performance || undefined
                  : undefined
              }
            />
          </div>
        )}
        <Spinner large className="absolute left-1/2 top-1/2" />
      </div>
      {state.wizardActive && coastline && eez && territorialSea && (
        <CreateGeographyWizard
          usedEEZs={unrepresentedTerritorialSeas}
          active={state.wizardActive}
          onRequestClose={() => {
            setState((prev: AdminState) => ({
              ...prev,
              wizardActive: false,
            }));
          }}
          usedTemplates={usedTemplates}
          landLayerId={coastline.id}
          eezLayer={{ ...eez, dataSource: eez.dataSource! }}
          territorialSeaLayer={{
            ...territorialSea,
            dataSource: territorialSea.dataSource!,
          }}
          map={map}
          onRequestToggleSidebar={handleToggleSidebar}
        />
      )}
      {state.editGeographyId && (
        <EditGeographyModal
          map={map}
          id={state.editGeographyId}
          onRequestClose={() => {
            setState((prev) => ({
              ...prev,
              editGeographyId: undefined,
              showLayerChoice: false,
            }));
          }}
          showLayerChoice={state.showLayerChoice}
          onShowLayerChoiceChange={(show) => {
            setState((prev) => ({
              ...prev,
              showLayerChoice: show,
            }));
          }}
        />
      )}
    </div>
  );
}

function combineBBoxes(bboxes: number[][]) {
  if (bboxes.length === 0) {
    return undefined;
  }

  // Track if we're crossing the antimeridian
  let crossesAntimeridian = false;

  // Initialize with the first box
  const firstBox = bboxes[0];
  let minX = firstBox[0];
  let minY = firstBox[1];
  let maxX = firstBox[2];
  let maxY = firstBox[3];

  // Check each box to see if any individual box spans the antimeridian
  for (const box of bboxes) {
    if (box[0] > box[2]) {
      crossesAntimeridian = true;
      break;
    }
  }

  if (crossesAntimeridian) {
    // Handle antimeridian crossing by shifting coordinates
    // For each bbox, if it's in the eastern hemisphere (positive longitude),
    // shift it to be "east" of the western hemisphere by adding 360
    for (const box of bboxes) {
      // If a box spans the antimeridian itself
      if (box[0] > box[2]) {
        minX = Math.min(minX, box[0]);
        maxX = Math.max(maxX, box[2] + 360); // Shift the east side
      } else if (box[0] > 0) {
        // Box is in eastern hemisphere
        minX = Math.min(minX, box[0] - 360); // Shift to continue from western hemisphere
        maxX = Math.max(maxX, box[2]);
      } else {
        // Box is in western hemisphere
        minX = Math.min(minX, box[0]);
        maxX = Math.max(maxX, box[2]);
      }
      minY = Math.min(minY, box[1]);
      maxY = Math.max(maxY, box[3]);
    }
  } else {
    // Standard case - check if the combined boxes might cross the antimeridian
    let eastMost = -180;
    let westMost = 180;

    for (const box of bboxes) {
      minY = Math.min(minY, box[1]);
      maxY = Math.max(maxY, box[3]);

      eastMost = Math.max(eastMost, box[2]);
      westMost = Math.min(westMost, box[0]);
    }

    // If we have boxes on both sides of the meridian and they're far apart
    if (westMost < 0 && eastMost > 0 && eastMost - westMost > 180) {
      // We need to shift coordinates
      crossesAntimeridian = true;

      // Recalculate with shifting
      minX = 180;
      maxX = -180;

      for (const box of bboxes) {
        if (box[0] > 0) {
          // Eastern hemisphere
          minX = Math.min(minX, box[0] - 360);
          maxX = Math.max(maxX, box[2] - 360);
        } else {
          // Western hemisphere
          minX = Math.min(minX, box[0]);
          maxX = Math.max(maxX, box[2]);
        }
      }
    } else {
      // Standard case, no special handling needed
      minX = westMost;
      maxX = eastMost;
    }
  }

  return [minX, minY, maxX, maxY];
}

function isOp(cql: any, op: string) {
  if (typeof cql === "object" && cql !== null && "op" in cql && cql.op === op) {
    return true;
  }
  return false;
}

function hasArg(cql: any, position: number, arg: any) {
  return deepEqual(getArg(cql, position), arg);
}

function getArg(cql: any, position: number) {
  if (
    typeof cql !== "object" ||
    cql === null ||
    !("args" in cql) ||
    !Array.isArray(cql.args)
  ) {
    return undefined;
  }
  return cql.args[position];
}
