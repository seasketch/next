import {
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
  });

  const coastline = data?.geographyClippingLayers?.find(
    (l) => l.dataSource?.dataLibraryTemplateId === COASTLINE
  );

  const eez = data?.geographyClippingLayers?.find(
    (l) => l.dataSource?.dataLibraryTemplateId === EEZ
  );

  const highSeas = data?.geographyClippingLayers?.find(
    (l) => l.dataSource?.dataLibraryTemplateId === HIGH_SEAS
  );

  const territorialSea = data?.geographyClippingLayers?.find(
    (l) => l.dataSource?.dataLibraryTemplateId === TERRITORIAL_SEA
  );

  const hasBuiltInLayers =
    Boolean(coastline) && Boolean(eez) && Boolean(territorialSea);

  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);

  const eezChoices = useEEZChoices();

  // Handle visibility checkbox toggle
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
      // add geography data sources and layers
      const sources: { [id: string]: mapboxgl.AnySourceData } = {};
      const hiddenGeogIds = state.hiddenGeographies;
      const layers: mapboxgl.AnyLayer[] = [];
      for (const geography of data.projectBySlug?.geographies || []) {
        if (hiddenGeogIds.includes(geography.id)) continue;
        for (const layer of geography.clippingLayers || []) {
          if (layer.dataLayer?.dataSource) {
            const sourceId = SOURCE_ID_PREFIX + layer.dataLayer.dataSource.id;
            if (!(sourceId in sources)) {
              if (
                layer.dataLayer.dataSource.type === DataSourceTypes.SeasketchMvt
              ) {
                sources[sourceId] = {
                  type: "vector",
                  url: layer.dataLayer.dataSource.url! + JSON_EXTENSION,
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
              const hasMatches = layers.some(
                (existingLayer: any) =>
                  existingLayer.metadata?.layerId === layer.dataLayer?.id
              );
              if (hasMatches) {
                continue;
              }

              for (const glLayer of layer.dataLayer.mapboxGlStyles) {
                const layerId =
                  LAYER_ID_PREFIX +
                  layer.dataLayer.id +
                  "-" +
                  layer.dataLayer.mapboxGlStyles.indexOf(glLayer);
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
              const layerId =
                LAYER_ID_PREFIX +
                layer.dataLayer.id +
                "-" +
                layer.dataLayer.mapboxGlStyles.indexOf(glLayer);
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
              {error ? (
                error.toString()
              ) : (
                <Trans ns="admin:geography">
                  SeaSketch has not been configured correctly with {EEZ},{" "}
                  {TERRITORIAL_SEA} and {COASTLINE} layers. Contact{" "}
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
      <div ref={mapRef} className="flex-1 relative">
        {map &&
          !state.wizardActive &&
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
      </div>
      {state.wizardActive && coastline && eez && territorialSea && (
        <CreateGeographyWizard
          active={state.wizardActive}
          onRequestClose={() => {
            setState((prev: AdminState) => ({
              ...prev,
              wizardActive: false,
            }));
          }}
          usedTemplates={usedTemplates}
          landLayerId={coastline.id}
          eezLayer={eez}
          territorialSeaLayer={territorialSea}
          map={map}
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
