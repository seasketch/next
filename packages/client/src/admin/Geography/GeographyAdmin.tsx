import {
  DotsHorizontalIcon,
  EnterFullScreenIcon,
  FileTextIcon,
  Pencil1Icon,
  Pencil2Icon,
  PlusCircledIcon,
} from "@radix-ui/react-icons";
import { Trans, useTranslation } from "react-i18next";
import {
  DataSourceTypes,
  SketchGeometryType,
  useGeographyClippingSettingsQuery,
} from "../../generated/graphql";
import Spinner from "../../components/Spinner";
import Warning from "../../components/Warning";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Switch from "../../components/Switch";
import getSlug from "../../getSlug";
import mapboxgl from "mapbox-gl";
import useEEZChoices, { labelForEEZ } from "./useEEZChoices";
import { createPortal } from "react-dom";
import MultiSelect from "../users/GroupMultiSelect";
import Button from "../../components/Button";
import useMapboxGLDraw, {
  DigitizingState,
  EMPTY_FEATURE_COLLECTION,
} from "../../draw/useMapboxGLDraw";
import { Feature } from "geojson";
import DigitizingTools from "../../formElements/DigitizingTools";
import CreateGeographyWizard, {
  CreateGeographyWizardState,
} from "./CreateGeographyWizard";
import VisibilityCheckbox from "../../dataLayers/tableOfContents/VisibilityCheckbox";
import { PlusCircleIcon } from "@heroicons/react/solid";
import EditGeographyModal from "./EditGeographyModal";

const EEZ = "MARINE_REGIONS_EEZ_LAND_JOINED";
const COASTLINE = "DAYLIGHT_COASTLINE";

export default function GeographyAdmin() {
  const { t } = useTranslation("admin:geography");
  const slug = getSlug();
  const { data, loading, error } = useGeographyClippingSettingsQuery({
    variables: { slug },
    skip: !slug,
  });

  const [state, setState] = useState<{
    mapLoaded: boolean;
    map: mapboxgl.Map | null;
    hiddenGeographies: number[];
    editGeographyId?: number;
  }>({
    mapLoaded: false,
    map: null,
    hiddenGeographies: [],
  });

  const [geographyWizardState, setGeographyWizardState] = useState<
    {
      active: boolean;
      usedTemplates: string[];
    } & CreateGeographyWizardState
  >({
    active: false,
    step: "chooseTemplate",
    multipleEEZHandling: "separate",
    eraseLand: true,
    usedTemplates: [],
  });

  const [eezPickerState, setEEZPickerState] = useState<{
    active: boolean;
    selectedEEZs: number[];
    saving: boolean;
    error?: Error;
    resultResolver?: (selectedEEZs: number[]) => void;
  }>({
    active: false,
    selectedEEZs: [],
    saving: false,
  });

  const coastline = data?.geographyClippingLayers?.find(
    (l) => l.dataSource?.dataLibraryTemplateId === COASTLINE
  );

  const eez = data?.geographyClippingLayers?.find(
    (l) => l.dataSource?.dataLibraryTemplateId === EEZ
  );

  const hasBuiltInLayers = Boolean(coastline) && Boolean(eez);

  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);

  const eezChoices = useEEZChoices();

  // Handle changes in the multi-select input
  const handleMultiSelectChange = (
    selectedGroups: { value: number; label: string }[]
  ) => {
    setEEZPickerState((prevState) => ({
      ...prevState,
      selectedEEZs: selectedGroups.map((group) => group.value),
    }));
    const eezs = eezChoices.data.filter((choice) =>
      selectedGroups.map((group) => group.value).includes(choice.value)
    );
    const bboxes = eezs.map((choice) => choice.data?.bbox);
    const bbox = combineBBoxes(bboxes);
    if (bbox) {
      map?.fitBounds(
        [
          [bbox[0], bbox[1]],
          [bbox[2], bbox[3]],
        ],
        {
          padding: 80,
          animate: true,
        }
      );
    }
  };

  // Handle visibility checkbox toggle (now hides on check)
  const handleGeographyVisibilityToggle = (geogId: number) => {
    setState((prev) => {
      const hiddenGeographies = prev.hiddenGeographies.includes(geogId)
        ? prev.hiddenGeographies.filter((id) => id !== geogId)
        : [...prev.hiddenGeographies, geogId];
      return { ...prev, hiddenGeographies };
    });
  };

  useEffect(() => {
    if (
      !map &&
      mapRef.current &&
      data?.gmapssatellitesession?.session &&
      eez?.dataSource?.url &&
      coastline?.dataSource?.url &&
      !eezChoices.loading
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
                `https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=${session}&key=${process.env.REACT_APP_GOOGLE_MAPS_2D_TILE_API_KEY}`,
              ],
              format: "jpeg",
              attribution: "Google",
              tileSize: 512,
            },
            eez: {
              type: "vector",
              url: eez.dataSource.url + ".json",
            },
            coastline: {
              type: "vector",
              url: coastline.dataSource.url + ".json",
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

      const activeEEZIds: number[] = [];
      // data?.projectBySlug?.eezSettings?.mrgidEez || [];
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

        if (eez && eez.dataSource) {
          newMap.addLayer({
            id: "eez-layer",
            type: "fill",
            source: "eez",
            "source-layer": eez.sourceLayer!,
            paint: {
              "fill-opacity": [
                "case",
                ["in", ["get", "MRGID_EEZ"], ["literal", activeEEZIds]],
                0.1,
                0,
              ],
              "fill-color": "#007cbf",
            },
          });

          newMap.addLayer({
            id: "eez-line",
            type: "line",
            source: "eez",
            "source-layer": eez.sourceLayer!,
            layout: {
              "line-cap": "round",
              "line-join": "round",
            },
            paint: {
              "line-opacity": [
                "case",
                ["in", ["get", "MRGID_EEZ"], ["literal", activeEEZIds]],
                0.6,
                0,
              ],
              "line-color": "grey",
              "line-width": [
                "case",
                ["boolean", ["feature-state", "hover"], false],
                2, // Thicker line width when hovered
                1, // Default line width
              ],
            },
          });
        }
        setState((prev) => ({ ...prev, mapLoaded: true, map: newMap }));
      });
      // @ts-ignore
      window.map = newMap;
    }
  }, [
    mapRef,
    data?.gmapssatellitesession?.session,
    eez?.dataSource?.url,
    coastline?.dataSource?.url,
    eezChoices.loading,
    setState,
  ]);

  useEffect(() => {
    if (
      state.mapLoaded &&
      data?.geographies &&
      state.map &&
      !eezPickerState.active // <-- Hide geography layers if EEZ picker is active
    ) {
      const map = state.map;
      // add geography data sources and layers
      const sources: { [id: string]: mapboxgl.AnySourceData } = {};
      // Only add layers for visible geographies (not hidden)
      const hiddenGeogIds = state.hiddenGeographies;
      const layers: mapboxgl.AnyLayer[] = [];
      for (const geography of data.projectBySlug?.geographies || []) {
        if (hiddenGeogIds.includes(geography.id)) continue;
        for (const layer of geography.clippingLayers || []) {
          if (layer.dataLayer?.dataSource) {
            // eslint-disable-next-line i18next/no-literal-string
            const sourceId = `source-${layer.dataLayer.dataSource.id}`;
            if (!(sourceId in sources)) {
              if (
                layer.dataLayer.dataSource.type === DataSourceTypes.SeasketchMvt
              ) {
                sources[sourceId] = {
                  type: "vector",
                  url: layer.dataLayer.dataSource.url! + ".json",
                };
              } else if (
                layer.dataLayer.dataSource.type === DataSourceTypes.Geojson
              ) {
                sources[sourceId] = {
                  type: "geojson",
                  data: layer.dataLayer.dataSource.url!,
                };
              } else {
                throw new Error(
                  `Unsupported data source type: ${layer.dataLayer.dataSource.type}`
                );
              }
            }
            if (layer.dataLayer.mapboxGlStyles?.length) {
              // check to make sure there aren't any existing layers with
              // matching cql2Query and source metadata before adding
              const hasMatches = layers.some(
                (existingLayer: any) =>
                  existingLayer.metadata?.layerId === layer.dataLayer?.id
              );
              if (hasMatches) {
                continue;
              }

              for (const glLayer of layer.dataLayer.mapboxGlStyles) {
                // eslint-disable-next-line i18next/no-literal-string
                const layerId = `layer-${
                  layer.dataLayer.id
                }-${layer.dataLayer.mapboxGlStyles.indexOf(glLayer)}`;
                const l = {
                  ...glLayer,
                  source: sourceId,
                  "source-layer": layer.dataLayer.sourceLayer,
                  id: layerId,
                  metadata: {
                    layerId: layer.dataLayer.id,
                  },
                };
                layers.push(l);
              }
            } else {
              throw new Error("Data layer does not have mapbox gl styles");
            }
          } else {
            throw new Error("Data layer does not have a data source");
          }
        }
      }

      // Add sources if not present
      for (const id in sources) {
        if (!map.getSource(id)) {
          map.addSource(id, sources[id]);
        }
      }
      // Remove layers not in the visible set
      const allLayerIds = new Set<string>();
      for (const geography of data.projectBySlug?.geographies || []) {
        for (const layer of geography.clippingLayers || []) {
          if (layer.dataLayer?.mapboxGlStyles?.length) {
            for (const glLayer of layer.dataLayer.mapboxGlStyles) {
              // eslint-disable-next-line i18next/no-literal-string
              const layerId = `layer-${
                layer.dataLayer.id
              }-${layer.dataLayer.mapboxGlStyles.indexOf(glLayer)}`;
              allLayerIds.add(layerId);
            }
          }
        }
      }
      // Remove all geography layers, then add only visible ones
      for (const layerId of allLayerIds) {
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId);
        }
      }
      for (const layer of layers) {
        if (!map.getLayer(layer.id)) {
          map.addLayer(layer);
        }
      }
      return () => {
        // Remove all geography layers on cleanup
        for (const layerId of allLayerIds) {
          if (map.getLayer(layerId)) {
            map.removeLayer(layerId);
          }
        }
      };
    }
    // Remove all geography layers if EEZ picker is active
    if (
      state.mapLoaded &&
      data?.geographies &&
      state.map &&
      eezPickerState.active
    ) {
      const map = state.map;
      const allLayerIds = new Set<string>();
      for (const geography of data.projectBySlug?.geographies || []) {
        for (const layer of geography.clippingLayers || []) {
          if (layer.dataLayer?.mapboxGlStyles?.length) {
            for (const glLayer of layer.dataLayer.mapboxGlStyles) {
              // eslint-disable-next-line i18next/no-literal-string
              const layerId = `layer-${
                layer.dataLayer.id
              }-${layer.dataLayer.mapboxGlStyles.indexOf(glLayer)}`;
              allLayerIds.add(layerId);
            }
          }
        }
      }
      for (const layerId of allLayerIds) {
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId);
        }
      }
    }
  }, [
    data?.projectBySlug?.geographies,
    state.mapLoaded,
    state.map,
    state.hiddenGeographies,
    eezPickerState.active,
  ]);

  // Setup tooltip and hover effects for when eez picker is active
  useEffect(() => {
    if (map && eezPickerState.active !== undefined && eez) {
      const tooltip = document.createElement("div");
      // eslint-disable-next-line i18next/no-literal-string
      tooltip.className = `absolute bg-white border border-gray-300 rounded-md p-1 text-sm bg-opacity-80 shadow-lg -left-12 -top-12`;
      document.body.appendChild(tooltip);

      let hoveredFeatureId: number | null = null;

      const handleMouseMove = (
        e: mapboxgl.MapMouseEvent & mapboxgl.EventData
      ) => {
        if (!eezPickerState.active) {
          tooltip.style.display = "none";
          return;
        }

        const feature = e.features?.[0];
        if (feature && feature.properties) {
          const label = labelForEEZ(feature.properties as any);
          tooltip.innerHTML = label;

          const mapContainer = map.getContainer();
          const rect = mapContainer.getBoundingClientRect();

          // eslint-disable-next-line i18next/no-literal-string
          tooltip.style.left = `${rect.left + e.point.x + 16}px`;
          // eslint-disable-next-line i18next/no-literal-string
          tooltip.style.top = `${rect.top + e.point.y + 16}px`;
          tooltip.style.display = "block";

          map.getCanvas().style.cursor = "pointer";

          // Update hover styling
          if (hoveredFeatureId !== null) {
            map.setFeatureState(
              {
                source: "eez",
                sourceLayer: eez.sourceLayer!,
                id: hoveredFeatureId,
              },
              { hover: false }
            );
          }
          hoveredFeatureId = feature.id as number;
          map.setFeatureState(
            {
              source: "eez",
              sourceLayer: eez.sourceLayer!,
              id: hoveredFeatureId,
            },
            { hover: true }
          );
        }
      };

      const handleMouseLeave = () => {
        tooltip.style.display = "none";
        map.getCanvas().style.cursor = "";

        // Reset hover styling
        if (hoveredFeatureId !== null) {
          map.setFeatureState(
            {
              source: "eez",
              sourceLayer: eez.sourceLayer!,
              id: hoveredFeatureId,
            },
            { hover: false }
          );
          hoveredFeatureId = null;
        }
      };

      map.on("mousemove", "eez-layer", handleMouseMove);
      map.on("mouseleave", "eez-layer", handleMouseLeave);

      const handleClick = (e: mapboxgl.MapMouseEvent & mapboxgl.EventData) => {
        const feature = e.features?.[0];
        if (feature && feature.properties) {
          const eezId = feature.properties.MRGID_EEZ;

          setEEZPickerState((prevState) => {
            const isSelected = prevState.selectedEEZs.includes(eezId);
            const updatedSelectedEEZs = isSelected
              ? prevState.selectedEEZs.filter((id) => id !== eezId) // Remove if already selected
              : [...prevState.selectedEEZs, eezId]; // Add if not selected

            return {
              ...prevState,
              selectedEEZs: updatedSelectedEEZs,
            };
          });
        }
      };

      map.on("click", "eez-layer", handleClick);

      return () => {
        map.off("mousemove", "eez-layer", handleMouseMove);
        map.off("mouseleave", "eez-layer", handleMouseLeave);
        map.off("click", "eez-layer", handleClick);
        tooltip.remove();
      };
    }
  }, [map, eezPickerState.active]);

  // Update EEZ layers whenever eez geography settings change
  useEffect(() => {
    if (map && eez) {
      const selectedEEZs = eezPickerState.active
        ? eezPickerState.selectedEEZs
        : [];
      // Update the fill-opacity for the EEZ layer based on eezPickerState
      if (
        // data?.projectBySlug?.eezSettings?.enableEezClipping ||
        eezPickerState.active
      ) {
        map.setPaintProperty("eez-layer", "fill-opacity", [
          "case",
          // If the picker is active, show all EEZs with appropriate opacity
          ["boolean", eezPickerState.active, false],
          0.2, // Higher opacity when in EEZ picker mode
          // If the picker is not active, hide non-selected EEZs
          ["in", ["get", "MRGID_EEZ"], ["literal", selectedEEZs]],
          0.1, // Default opacity for selected EEZs
          0, // Hide non-selected EEZs
        ]);
        map.setPaintProperty("eez-line", "line-opacity", [
          "case",
          // If the picker is active, show all EEZs with appropriate opacity
          ["boolean", eezPickerState.active, false],
          0.5, // Higher opacity when in EEZ picker mode
          // If the picker is not active, hide non-selected EEZs
          ["in", ["get", "MRGID_EEZ"], ["literal", selectedEEZs]],
          0.6, // Default opacity for selected EEZs
          0, // Hide non-selected EEZs
        ]);
      } else {
        map.setPaintProperty("eez-layer", "fill-opacity", 0);
        map.setPaintProperty("eez-line", "line-opacity", 0);
      }

      if (eezPickerState.active) {
        map.setPaintProperty("eez-layer", "fill-color", [
          "case",
          ["boolean", ["in", ["get", "MRGID_EEZ"], ["literal", selectedEEZs]]],
          "yellow",
          "#007cbf",
        ]);
        map.setPaintProperty("eez-line", "line-color", [
          "case",
          ["boolean", ["in", ["get", "MRGID_EEZ"], ["literal", selectedEEZs]]],
          "#ffc107",
          "grey",
        ]);
      } else {
        map.setPaintProperty("eez-layer", "fill-color", "#007cbf");
        map.setPaintProperty("eez-line", "line-color", "grey");
      }
    }
  }, [map, eez, eezPickerState.active, eezPickerState.selectedEEZs]);

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
    return {
      removeLand: true,
      landDataset:
        (coastline?.dataSource?.url || "").replace(
          "https://tiles.seasketch.org/",
          ""
        ) + ".fgb",
      clipToEEZIds: [],
      eezDataset:
        (eez?.dataSource?.url || "").replace(
          "https://tiles.seasketch.org/",
          ""
        ) + ".fgb",
    };
  }, [coastline?.dataSource?.url, eez?.dataSource?.url]);

  const draw = useMapboxGLDraw(
    mapContext,
    SketchGeometryType.Polygon,
    EMPTY_FEATURE_COLLECTION,
    (feature) => {
      setDrawFeature(feature);
    },
    undefined,
    "https://overlay.seasketch.org/clip",
    // "http://localhost:8787/clip",
    // "https://h13gfvr460.execute-api.us-west-2.amazonaws.com/prod/eraseLand", // preprocessing function
    (geom, performance) => {
      // console.log("geom", geom, performance);
    },
    extraRequestParams
  );

  useEffect(() => {
    if (!data?.projectBySlug?.geographies) {
      return;
    }
    const usedTemplates = [] as string[];
    for (const geography of data.projectBySlug.geographies) {
      if (geography.clientTemplate) {
        usedTemplates.push(geography.clientTemplate);
      }
    }
    setGeographyWizardState((prev) => ({
      ...prev,
      usedTemplates: Array.from(new Set(usedTemplates)),
    }));
  }, [data?.projectBySlug?.geographies]);

  return (
    <div className="w-full h-full flex">
      <nav className="w-96 bg-white h-full overflow-y-auto border-r border-black border-opacity-10 flex flex-col">
        <h1 className="p-4 font-semibold">
          <Trans ns="admin:geograpy">Geography</Trans>
        </h1>
        <p className="px-4 text-sm">
          <Trans ns="admin:geography">
            Geographies represent spatial areas where sketches can be drawn and
            define regions where you would like to aggregate metrics for
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
                  SeaSketch has not been configured correctly with {EEZ} and{" "}
                  {COASTLINE} layers. Contact{" "}
                  <a className="underline" href="mailto:support@seasketch.org">
                    support@seasketch.org
                  </a>{" "}
                  for assistance.
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
                    // Checkbox is checked if hidden, unchecked if visible
                    visibility={!state.hiddenGeographies.includes(geog.id)}
                    id={geog.id}
                    onClick={() => handleGeographyVisibilityToggle(geog.id)}
                  />
                  <span className="flex-1">{geog.name}</span>
                  <span className="space-x-2 flex items-center">
                    <button
                      onClick={() => {
                        if (geog.bounds) {
                          map?.fitBounds(
                            geog.bounds as [number, number, number, number],
                            {
                              padding: 80,
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
          {state.editGeographyId && (
            <EditGeographyModal
              id={state.editGeographyId}
              onRequestClose={() => {
                setState((prev) => ({
                  ...prev,
                  editGeographyId: undefined,
                }));
              }}
            />
          )}
          {!loading && (
            <div className="px-2 -mt-1">
              <button
                onClick={() => {
                  setGeographyWizardState((prev) => ({
                    ...prev,
                    active: true,
                    step: "chooseTemplate",
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
      <div ref={mapRef} className="flex-1 relative">
        {map &&
          !eezPickerState.active &&
          data?.projectBySlug?.geographies?.length && (
            <div className="absolute top-0 left-0 p-3 flex items-center space-x-2 z-10">
              <Button
                className=""
                small
                label={t("Draw polygon")}
                onClick={() => {
                  draw.setCollection(EMPTY_FEATURE_COLLECTION);
                  draw.create(false, true);
                }}
              >
                <span className="flex items-center space-x-1">
                  <Pencil1Icon />
                  <span>{t("Draw polygon")}</span>
                </span>
              </Button>
              {(drawFeature ||
                (draw.digitizingState !== DigitizingState.DISABLED &&
                  draw.digitizingState !== DigitizingState.NO_SELECTION)) && (
                <>
                  <Button
                    small
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
                </>
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
        {eezPickerState.active && (
          <div className="absolute w-full h-32 z-50 text-base">
            <div
              className="mx-auto p-4 bg-white border-b border-gray-200"
              style={{ maxWidth: "50%" }}
            >
              <MultiSelect
                filterOption={(option, rawInput) => {
                  const input = rawInput.toLowerCase();
                  return (
                    option.label.toLowerCase().includes(input) ||
                    option.value.toString().includes(input) ||
                    option.data?.data?.SOVEREIGN1?.toLowerCase().includes(input)
                  );
                }}
                title={t("Select one or more Exclusive Economic Zones")}
                description={t(
                  "Nations may have more than one polygon associated with their EEZ. You should select all those where users will be doing planning within this project. Use the list below to select areas, or click polygons on the map."
                )}
                groups={eezChoices.data}
                value={eezPickerState.selectedEEZs
                  .map((id) => {
                    const match = eezChoices.data.find(
                      (choice) => choice.value === id
                    );
                    if (!match) {
                      throw new Error("EEZ not found");
                    }
                    return { value: match.value, label: match.label };
                  })
                  .filter(Boolean)}
                onChange={handleMultiSelectChange}
                loading={eezChoices.loading}
              />
              {eezPickerState.error && (
                <Warning level="error">{eezPickerState.error.message}</Warning>
              )}
              <div className="space-x-2">
                <Button
                  label={t("Cancel")}
                  disabled={eezPickerState.saving}
                  onClick={() =>
                    setEEZPickerState({
                      ...eezPickerState,
                      active: false,
                      selectedEEZs: [] as number[],
                    })
                  }
                />
                <Button
                  label={t("Continue")}
                  primary
                  loading={eezPickerState.saving}
                  onClick={async () => {
                    if (eezPickerState.resultResolver) {
                      // If we have a result promise, resolve it with the selected EEZs
                      eezPickerState.resultResolver(
                        eezPickerState.selectedEEZs
                      );
                    }
                    setEEZPickerState((prev) => ({
                      ...prev,
                      active: false,
                      saving: false,
                      selectedEEZs: eezPickerState.selectedEEZs,
                      resultResolver: undefined,
                    }));
                    const eezs = eezChoices.data.filter((choice) =>
                      eezPickerState.selectedEEZs.includes(choice.value)
                    );
                    const bboxes = eezs.map((choice) => choice.data?.bbox);
                    const bbox = combineBBoxes(bboxes);
                    if (bbox) {
                      map?.fitBounds(
                        [
                          [bbox[0], bbox[1]],
                          [bbox[2], bbox[3]],
                        ],
                        {
                          padding: 80,
                          animate: true,
                        }
                      );
                    }
                  }}
                  disabled={
                    eezPickerState.selectedEEZs.length === 0 ||
                    eezPickerState.saving
                  }
                />
              </div>
            </div>
          </div>
        )}
      </div>
      {geographyWizardState.active && coastline && eez && (
        <CreateGeographyWizard
          state={geographyWizardState}
          // @ts-ignore
          setState={setGeographyWizardState}
          usedTemplates={geographyWizardState.usedTemplates}
          onRequestClose={() => {
            setGeographyWizardState((prev) => ({
              ...prev,
              active: false,
            }));
          }}
          onRequestEEZPicker={() => {
            setEEZPickerState((prev) => ({
              ...prev,
              active: true,
              selectedEEZs: [],
            }));
            return new Promise<number[]>((resolve) => {
              setEEZPickerState((prev) => ({
                ...prev,
                resultResolver: resolve,
              }));
            });
          }}
          landLayerId={coastline.id}
          eezLayerId={eez.id}
        />
      )}
      {createPortal(
        <div
          className={`${
            eezPickerState.active ? "opacity-100" : "opacity-0"
          } absolute left-0 top-0 h-full bg-black bg-opacity-10 z-50 transition-opacity pointer-events-none backdrop-blur-sm`}
          style={{ width: 608 }}
        ></div>,
        document.body
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
