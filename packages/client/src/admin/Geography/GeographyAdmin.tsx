import {
  DotsHorizontalIcon,
  FileTextIcon,
  Pencil1Icon,
} from "@radix-ui/react-icons";
import { Trans, useTranslation } from "react-i18next";
import {
  SketchGeometryType,
  useGeographyClippingSettingsQuery,
  useUpdateEezClippingSettingsMutation,
  useUpdateLandClippingSettingsMutation,
} from "../../generated/graphql";
import Spinner from "../../components/Spinner";
import Warning from "../../components/Warning";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Switch from "../../components/Switch";
import getSlug from "../../getSlug";
import LandClippingModal from "./LandClippingModal";
import EEZClippingModal from "./EEZClippingModal";
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

const EEZ = "MARINE_REGIONS_EEZ_LAND_JOINED";
const COASTLINE = "DAYLIGHT_COASTLINE";

export default function GeographyAdmin() {
  const { t } = useTranslation("admin:geography");
  const slug = getSlug();
  const { data, loading, error } = useGeographyClippingSettingsQuery({
    variables: { slug },
    skip: !slug,
  });
  const [openModalsState, setOpenModalsState] = useState<{
    land: boolean;
    eez: boolean;
  }>({ land: false, eez: false });

  const [eezPickerState, setEEZPickerState] = useState<{
    active: boolean;
    selectedEEZs: number[];
    saving: boolean;
    error?: Error;
  }>({
    active: false,
    selectedEEZs: [],
    saving: false,
  });

  useEffect(() => {
    if (data?.projectBySlug?.eezSettings?.mrgidEez) {
      const ids = data.projectBySlug.eezSettings.mrgidEez as number[];
      setEEZPickerState((prev) => ({
        ...prev,
        selectedEEZs: ids,
      }));
    }
  }, [data?.projectBySlug?.eezSettings?.mrgidEez]);

  const [updateLandClippingMutation, updateLandClippingState] =
    useUpdateLandClippingSettingsMutation();

  const [updateEEZClippingMutation, updateEEZClippingMutationState] =
    useUpdateEezClippingSettingsMutation();

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

  useEffect(() => {
    if (
      !map &&
      mapRef.current &&
      data?.gmapssatellitesession?.session &&
      eez?.dataSource?.url &&
      coastline?.dataSource?.url &&
      !eezChoices.loading &&
      data?.projectBySlug?.eezSettings?.mrgidEez
    ) {
      let bbox: number[] | undefined;
      if (data.projectBySlug.eezSettings.mrgidEez.length > 0) {
        const ids = data.projectBySlug.eezSettings.mrgidEez as number[];
        // get bboxes for each eez
        const eezs = eezChoices.data.filter((choice) =>
          ids.includes(choice.value)
        );
        const bboxes = eezs.map((choice) => choice.data?.bbox);
        // combine bboxes
        if (bboxes.length > 0) {
          bbox = combineBBoxes(bboxes);
        }
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
      });

      newMap.on("load", () => {
        setMap(newMap);

        if (eez && eez.dataSource) {
          newMap.addLayer({
            id: "eez-layer",
            type: "fill",
            source: "eez",
            "source-layer": eez.sourceLayer!,
            paint: {
              "fill-opacity": [
                "case",
                [
                  "in",
                  ["get", "MRGID_EEZ"],
                  ["literal", data?.projectBySlug?.eezSettings?.mrgidEez || []],
                ],
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
                [
                  "in",
                  ["get", "MRGID_EEZ"],
                  ["literal", data?.projectBySlug?.eezSettings?.mrgidEez || []],
                ],
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
      });
      // @ts-ignore
      window.map = newMap;
    }
  }, [
    mapRef,
    data?.gmapssatellitesession?.session,
    eez?.dataSource?.url,
    coastline?.dataSource?.url,
    data?.projectBySlug?.eezSettings?.mrgidEez,
    eezChoices.loading,
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
        : data?.projectBySlug?.eezSettings?.mrgidEez || [];
      // Update the fill-opacity for the EEZ layer based on eezPickerState
      if (
        data?.projectBySlug?.eezSettings?.enableEezClipping ||
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
  }, [
    map,
    eez,
    eezPickerState.active,
    data?.projectBySlug?.eezSettings?.mrgidEez,
    eezPickerState.selectedEEZs,
    data?.projectBySlug?.eezSettings?.enableEezClipping,
  ]);

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
      removeLand: data?.projectBySlug?.eezSettings?.enableLandClipping || false,
      landDataset:
        (coastline?.dataSource?.url || "").replace(
          "https://tiles.seasketch.org/",
          ""
        ) + ".fgb",
      clipToEEZIds: data?.projectBySlug?.eezSettings?.enableEezClipping
        ? data?.projectBySlug?.eezSettings?.mrgidEez || []
        : [],
      eezDataset:
        (eez?.dataSource?.url || "").replace(
          "https://tiles.seasketch.org/",
          ""
        ) + ".fgb",
    };
  }, [
    data?.projectBySlug?.eezSettings?.enableLandClipping,
    data?.projectBySlug?.eezSettings?.enableEezClipping,
    data?.projectBySlug?.eezSettings?.mrgidEez,
    coastline?.dataSource?.url,
    eez?.dataSource?.url,
  ]);

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
              <Trans ns="admin:geography">
                SeaSketch has not been configured correctly with {EEZ} and{" "}
                {COASTLINE} layers. Contact{" "}
                <a className="underline" href="mailto:support@seasketch.org">
                  support@seasketch.org
                </a>{" "}
                for assistance.
              </Trans>
            </Warning>
          )}
          {!loading && (
            <ul className="w-full p-2">
              <GeographyLayerItem
                name="Remove Land"
                enabled={Boolean(
                  data?.projectBySlug?.eezSettings?.enableLandClipping
                )}
                onEdit={() => setOpenModalsState({ land: true, eez: false })}
                onToggle={(enabled) => {
                  updateLandClippingMutation({
                    variables: { enable: enabled, slug },
                    optimisticResponse: {
                      __typename: "Mutation",
                      updateLandClippingSettings: {
                        __typename: "UpdateLandClippingSettingsPayload",
                        projectEezSetting: {
                          id: data!.projectBySlug!.eezSettings!.id,
                          __typename: "ProjectEezSetting",
                          enableLandClipping: enabled,
                          projectId: data?.projectBySlug?.id,
                          eezSelections:
                            data?.projectBySlug?.eezSettings?.eezSelections,
                        },
                      },
                    },
                  });
                }}
              />
              <GeographyLayerItem
                name="Limit to Exclusive Economic Zone"
                enabled={Boolean(
                  data?.projectBySlug?.eezSettings?.enableEezClipping &&
                    data?.projectBySlug?.eezSettings?.eezSelections?.length
                )}
                onEdit={() => {
                  setOpenModalsState({ land: false, eez: true });
                }}
                description={
                  data?.projectBySlug?.eezSettings?.eezSelections?.length ? (
                    data.projectBySlug.eezSettings.eezSelections.join(", ")
                  ) : (
                    <Trans ns="admin:geography">
                      <button
                        onClick={() =>
                          setEEZPickerState((prev) => ({
                            ...prev,
                            active: true,
                          }))
                        }
                        className="hover:underline"
                      >
                        Choose an EEZ
                      </button>{" "}
                      to enable this layer
                    </Trans>
                  )
                }
                onToggle={(enabled) => {
                  if (
                    (data?.projectBySlug?.eezSettings?.eezSelections || [])
                      .length === 0
                  ) {
                    setEEZPickerState((prev) => ({
                      ...prev,
                      active: true,
                    }));
                    // setOpenModalsState({ land: false, eez: true });
                  } else {
                    // do the mutation
                    updateEEZClippingMutation({
                      variables: {
                        eezSelections: data?.projectBySlug?.eezSettings
                          ?.eezSelections as string[],
                        slug,
                        enable: enabled,
                        ids: data?.projectBySlug?.eezSettings
                          ?.mrgidEez as number[],
                      },
                    });
                  }
                }}
              />
            </ul>
          )}
        </div>
      </nav>
      {openModalsState.land && (
        <LandClippingModal
          onRequestClose={() => setOpenModalsState({ land: false, eez: false })}
          enabled={Boolean(
            data?.projectBySlug?.eezSettings?.enableLandClipping
          )}
          lastUpdated={new Date(coastline?.dataSource?.createdAt)}
          author={coastline?.dataSource?.authorProfile!}
        />
      )}
      {openModalsState.eez && (
        <EEZClippingModal
          onRequestClose={() => setOpenModalsState({ land: false, eez: false })}
          enabled={Boolean(
            data?.projectBySlug?.eezSettings?.enableEezClipping &&
              data?.projectBySlug?.eezSettings?.eezSelections?.length
          )}
          lastUpdated={new Date(eez?.dataSource?.createdAt)}
          author={eez?.dataSource?.authorProfile!}
          selectedEEZs={
            (data?.projectBySlug?.eezSettings?.eezSelections as string[]) || []
          }
          onRequestEEZPicker={() => {
            setOpenModalsState({ land: false, eez: false });
            setEEZPickerState((prev) => ({
              ...prev,
              active: true,
              selectedEEZs:
                (data?.projectBySlug?.eezSettings?.mrgidEez as number[]) || [],
            }));
          }}
        />
      )}
      <div ref={mapRef} className="flex-1 relative">
        {map && !eezPickerState.active && (
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
                title={t("Select one or more Exclusive Economic Zones")}
                description={t(
                  "Nations may have more than one polygon associated with their EEZ. You should select all those where users will be doing planning within this project. Use the list below to select areas, or click polygons on the map."
                )}
                groups={eezChoices.data.map((choice) => ({
                  value: choice.value,
                  label: choice.label,
                }))}
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
              <Button
                label={t("Cancel")}
                disabled={eezPickerState.saving}
                onClick={() =>
                  setEEZPickerState({
                    ...eezPickerState,
                    active: false,
                    selectedEEZs: (data?.projectBySlug?.eezSettings?.mrgidEez ||
                      []) as number[],
                  })
                }
              />
              <Button
                label={t("Save")}
                primary
                loading={eezPickerState.saving}
                onClick={async () => {
                  setEEZPickerState((prev) => ({
                    ...prev,
                    saving: true,
                  }));
                  try {
                    await updateEEZClippingMutation({
                      variables: {
                        eezSelections: eezChoices.data
                          .filter((eez) =>
                            eezPickerState.selectedEEZs.includes(eez.value)
                          )
                          .map((eez) => eez.label),
                        slug: getSlug(),
                        enable: true,
                        ids: eezPickerState.selectedEEZs,
                      },
                    });
                    setEEZPickerState((prev) => ({
                      ...prev,
                      active: false,
                      saving: false,
                      selectedEEZs: eezPickerState.selectedEEZs,
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
                  } catch (error) {
                    setEEZPickerState((prev) => ({
                      ...prev,
                      error: error as Error,
                      saving: false,
                    }));
                  }
                }}
                disabled={
                  eezPickerState.selectedEEZs.length === 0 ||
                  eezPickerState.saving
                }
              />
            </div>
          </div>
        )}
      </div>
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

function GeographyLayerItem({
  name,
  description,
  enabled,
  onEdit,
  onToggle,
}: {
  name: ReactNode;
  description?: ReactNode;
  enabled: boolean;
  onEdit?: () => void;
  onToggle?: (enabled: boolean) => void;
}) {
  return (
    <div className="m-2 rounded-md p-2 border-b border-gray-200 text-sm bg-white shadow-sm flex space-x-2 items-center">
      <Switch
        onClick={onToggle}
        className="transform scale-75"
        isToggled={enabled}
      />
      <div className="flex-1">
        <h2 className="font-semibold">{name}</h2>
        {description && <p className="text-xs">{description}</p>}
      </div>
      <button
        onClick={onEdit}
        className="rounded-full bg-gray-50 text-center w-8 h-8 flex items-center justify-center border border-black border-opacity-5"
      >
        <DotsHorizontalIcon className="inline" />
      </button>
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
