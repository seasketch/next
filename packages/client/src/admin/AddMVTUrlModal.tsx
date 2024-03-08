import { Trans, useTranslation } from "react-i18next";
import AddRemoteServiceMapModal from "./data/AddRemoteServiceMapModal";
import {
  FormEvent,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import useDialog from "../components/useDialog";
import { v4 as uuid } from "uuid";
import {
  DraftTableOfContentsDocument,
  useCreateMvtSourceMutation,
} from "../generated/graphql";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import useProjectId from "../useProjectId";
import Button from "../components/Button";
import tilebelt from "@mapbox/tilebelt";
import Protobuf from "pbf";
import { VectorTile, VectorTileFeature } from "@mapbox/vector-tile";
import { Geostats } from "./data/GLStyleEditor/GeostatsModal";
import Spinner from "../components/Spinner";
import Switch from "../components/Switch";
import Warning from "../components/Warning";
import { GeoJSONSource } from "mapbox-gl";
import bbox from "@turf/bbox";
import { MapContext } from "../dataLayers/MapContextManager";

export default function AddMVTUrlModal({
  onRequestClose,
}: {
  onRequestClose: () => void;
}) {
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const { t } = useTranslation("admin:data");
  const urlInput = useRef<HTMLInputElement>(null);
  const { alert } = useDialog();
  const [state, setState] = useState({
    evaluating: false,
    progressMessage: "",
    geostats: null as Geostats | null,
    canImport: false,
    selectedLayers: [] as string[],
    wasSubmitted: false,
    minZoom: 0,
    maxZoom: 1,
    bounds: null as number[] | null,
    error: undefined as string | undefined,
    abortController: new AbortController(),
    featureBounds: null as number[] | null,
  });
  const projectId = useProjectId();

  const onError = useGlobalErrorHandler();
  const [mutate, mutationState] = useCreateMvtSourceMutation({
    onError,
    refetchQueries: [DraftTableOfContentsDocument],
  });

  const mapContext = useContext(MapContext);

  const resetMap = useCallback(() => {
    if (map) {
      const layers = map.getStyle().layers || [];
      const forRemoval = layers.filter((l) => l.id.startsWith("mvt-"));
      const sourcesToRemove = new Set<string>();
      for (const layer of forRemoval) {
        if ("source" in layer) {
          sourcesToRemove.add(layer.source as string);
        }
        map.removeLayer(layer.id);
      }
      for (const source of sourcesToRemove) {
        map.removeSource(source);
      }
      const source = map.getSource("search-tile") as GeoJSONSource;
      if (source) {
        source.setData({
          type: "FeatureCollection",
          features: [],
        });
      }
    }
  }, [map]);

  const onSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      if (form && urlInput.current) {
        resetMap();
        setState((s) => ({ ...s, wasSubmitted: true }));
        const formData = new FormData(form);
        const url = formData.get("urlTemplate") as string;
        const validationErrors = validateUrl(url);
        if (validationErrors.length) {
          setValidationMessage(urlInput.current, validationErrors.join("\n"));
          setState((s) => ({ ...s, canImport: false }));
        } else {
          const abortController = new AbortController();
          setState({
            ...state,
            evaluating: true,
            progressMessage: "Fetching data...",
            geostats: null,
            error: undefined,
            abortController,
          });
          try {
            const bounds = map!.getBounds().toArray();
            const data = await evaluateMVTUrlTemplate(
              url,
              [bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]],
              abortController.signal,
              (message, geostats, minZoom, maxZoom, tile) => {
                if (tile) {
                  const geojson = tilebelt.tileToGeoJSON(tile);
                  if (map) {
                    const source = map.getSource(
                      "search-tile"
                    ) as GeoJSONSource;
                    if (source) {
                      source.setData({
                        type: "Feature",
                        properties: {},
                        geometry: geojson,
                      });
                      // @ts-ignore
                      map.fitBounds(tilebelt.tileToBBOX(tile), {
                        duration: 3000,
                        // speed: 0.2,
                        padding: 150,
                      });
                    }
                  }
                }
                setState((prev) => ({
                  ...prev,
                  // eslint-disable-next-line i18next/no-literal-string
                  progressMessage: message,
                  error: undefined,
                }));
              }
            );
            setState({
              ...state,
              evaluating: false,
              geostats: data.geostats,
              minZoom: data.minZoom || 0,
              maxZoom: data.maxZoom || 0,
              bounds: data.bounds || null,
              selectedLayers: data.geostats.layers.map((l) => l.layer),
              error: undefined,
              featureBounds: data.roughFeatureBounds,
            });
            if (data.bounds && map) {
              // @ts-ignore
              map.fitBounds(data.roughFeatureBounds || data.bounds, {
                padding: 350,
              });
            }
            setValidationMessage(urlInput.current, "");
            // Add to map
            if (map) {
              setState((s) => ({ ...s, canImport: true }));
              const source = map.getSource("search-tile") as GeoJSONSource;
              if (source) {
                source.setData({
                  type: "FeatureCollection",
                  features: [],
                });
              }
              const sourceId = uuid();
              map.addSource(sourceId, {
                type: "vector",
                tiles: [url],
                maxzoom: data.maxZoom,
                minzoom: data.minZoom,
                bounds: data.bounds,
              });
              for (const sourceLayer of (data.geostats?.layers || []).map(
                (l) => l.layer
              ) || []) {
                for (const layer of getGLStyleLayers(
                  data.geostats!,
                  sourceId,
                  sourceLayer
                )) {
                  map.addLayer(layer);
                }
              }
            } else {
              alert("Map not ready");
            }
          } catch (e) {
            if (/aborted/i.test(e.message)) {
              setState({
                ...state,
                evaluating: false,
                geostats: null,
                error: undefined,
              });
              resetMap();
            } else {
              setState({
                ...state,
                evaluating: false,
                geostats: null,
                error: e.message,
              });
            }
          }
        }
      }
    },
    [setState, map, alert, urlInput, resetMap, state]
  );

  const [zoom, setZoom] = useState(0);
  useEffect(() => {
    if (map) {
      const onZoom = () => {
        setZoom(Math.round((map?.getZoom() || 0) * 10) / 10);
      };
      map.on("zoom", onZoom);
      setZoom(Math.round((map?.getZoom() || 0) * 10) / 10);
      return () => {
        map?.off("zoom", onZoom);
      };
    }
  }, [map]);

  const onChange = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      if (state.wasSubmitted && urlInput.current) {
        const form = e.currentTarget;
        const formData = new FormData(form);
        const url = formData.get("urlTemplate") as string;
        const validationErrors = validateUrl(url);
        if (validationErrors.length) {
          setValidationMessage(urlInput.current, validationErrors.join("\n"));
          setState((s) => ({
            ...s,
            canImport: false,
            error: undefined,
            geostats: null,
          }));
        } else {
          setValidationMessage(urlInput.current, "");
          if (state.geostats) {
            setState((prev) => ({
              ...prev,
              geostats: null,
              canImport: false,
              error: undefined,
            }));
          } else if (state.error) {
            setState((prev) => ({
              ...prev,
              error: undefined,
            }));
          }
        }
      } else {
        if (state.geostats) {
          setState((prev) => ({
            ...prev,
            geostats: null,
            canImport: false,
            error: undefined,
          }));
        }
      }
    },
    [urlInput, setState, state.geostats, state.wasSubmitted, state.error]
  );

  useEffect(() => {
    if (map) {
      const sourceLayers = state.geostats?.layers.map((l) => l.layer) || [];
      const layers = map.getStyle().layers || [];
      for (const sourceLayer of sourceLayers) {
        for (const layer of layers) {
          if (
            "source-layer" in layer &&
            layer["source-layer"] === sourceLayer
          ) {
            if (state.selectedLayers.includes(sourceLayer)) {
              map.setLayoutProperty(layer.id, "visibility", "visible");
            } else {
              map.setLayoutProperty(layer.id, "visibility", "none");
            }
          }
        }
      }
    }
  }, [state.selectedLayers, state.geostats?.layers, map]);

  return (
    <AddRemoteServiceMapModal
      title={t("Add Mapbox Vector Tiles by URL")}
      onRequestClose={onRequestClose}
      onMapLoad={(map) => {
        // @ts-ignore
        window.map = map;
        if (!map.getLayer("search-tile-fill")) {
          if (!map.getSource("search-tile")) {
            map.addSource("search-tile", {
              type: "geojson",
              data: {
                type: "FeatureCollection",
                features: [],
              },
            });
          }
          map.addLayer({
            id: "search-tile-fill",
            type: "fill",
            source: "search-tile",
            paint: {
              "fill-color": "#0a0",
              "fill-outline-color": "green",
              "fill-opacity": 0.2,
            },
          });
          map.addLayer({
            id: "search-tile-line-blur",
            type: "line",
            source: "search-tile",
            layout: {
              "line-cap": "round",
            },
            paint: {
              "line-color": "rgba(100, 255, 100, 0.3)",
              "line-width": 15,
              "line-offset": -3,
              "line-blur": 10,
            },
          });
          map.addLayer({
            id: "search-tile-line",
            type: "line",
            source: "search-tile",
            paint: {
              "line-color": "rgb(128, 255, 57)",
              "line-width": 3,
            },
          });
        }
        setMap(map);
      }}
    >
      <div className="absolute right-0 rounded z-50 bg-black text-indigo-300 px-1.5 py-0.5 mr-1 mt-1 bg-opacity-50">
        <Trans data={{ zoom }} ns="admin:data">
          Zoom = {{ zoom }}
        </Trans>
      </div>
      <div className="p-4 space-y-4 max-h-full overflow-y-auto">
        <p className="text-sm">
          <Trans ns="admin:data">
            Any public service which conforms to the{" "}
            <a
              className="text-primary-500"
              href="https://github.com/mapbox/vector-tile-spec"
              target="_blank"
            >
              Mapbox Vector Tile specification
            </a>{" "}
            (mvt) can be added to SeaSketch using a url template. Enter the url
            of the vector tile service below, with placeholders for {`{z}`},{" "}
            {`{x}`}, and {`{y}`}. Cartography can be customized after import.
          </Trans>
        </p>
        {/* <Warning level="info">
          {t(
            "If you have a TileJSON endpoint for this service, details such as source layer ids, zoom levels, and bounds can be automatically detected. If possible, use that import option instead."
          )}
        </Warning> */}
        <form
          id="remote-mvt-form"
          name="mvt"
          className="space-y-2"
          onSubmit={onSubmit}
          onChange={onChange}
        >
          <label
            htmlFor="urlTemplate"
            className="block text-sm font-medium leading-5 text-gray-800 required"
          >
            {t("URL Template")}
          </label>
          <input
            ref={urlInput}
            name="urlTemplate"
            placeholder="https://example.com/tiles/{z}/{x}/{y}.pbf"
            type="text"
            required
            disabled={state.evaluating}
            className={`w-full border-gray-300 rounded-md focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5 text-black ${
              state.evaluating ? "opacity-50" : ""
            }`}
          />
          {state.geostats && state.geostats.layerCount === 0 && (
            <Warning level="error">
              {t(
                "No data was found at the provided URL. Check the URL and try again."
              )}
            </Warning>
          )}
          {state.error && <Warning level="error">{state.error}</Warning>}
          {state.geostats && state.geostats.layerCount > 0 && (
            <>
              <div className="p-3 border border-gray-300 rounded">
                <h3 className="p-0">{t("Layers")}</h3>
                <p className="text-sm text-gray-500 mb-3">
                  <Trans ns="admin:data">
                    Choose one or more of these layers to import as seperate
                    table of contents items.
                  </Trans>
                </p>
                {state.geostats.layers.map((layer) => {
                  return (
                    <div className="flex" key={layer.layer}>
                      <span className="block text-sm font-medium leading-5 text-gray-800 flex-1 font-mono">
                        {layer.layer}
                      </span>
                      <Switch
                        isToggled={state.selectedLayers.includes(layer.layer)}
                        onClick={(val) => {
                          setState((prev) => ({
                            ...prev,
                            selectedLayers: val
                              ? prev.selectedLayers.concat(layer.layer)
                              : prev.selectedLayers.filter(
                                  (l) => l !== layer.layer
                                ),
                          }));
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="p-3 border-gray-300 border rounded">
                <div className="">
                  <h3>{t("Zoom range")}</h3>
                  <p className="text-sm text-gray-500">
                    <Trans ns="admin:data">
                      This zoom range was determined by inspecting the service,
                      but can also be manually specified.
                    </Trans>
                  </p>
                  <div className="mt-2">
                    <input
                      className=" border-gray-300 rounded-md focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5 text-black"
                      name="min-zoom"
                      type="number"
                      min={0}
                      max={Math.min(18, state.maxZoom - 1)}
                      onChange={(e) => {
                        const minZoom = parseInt(e.target.value);
                        setState((prev) => ({
                          ...prev,
                          minZoom,
                        }));
                      }}
                      value={state.minZoom}
                    />
                    <span>-</span>
                    <input
                      className=" border-gray-300 rounded-md focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5 text-black"
                      name="max-zoom"
                      type="number"
                      min={Math.max(0, state.minZoom)}
                      max={18}
                      onChange={(e) => {
                        const maxZoom = parseInt(e.target.value);
                        setState((prev) => ({
                          ...prev,
                          maxZoom,
                        }));
                      }}
                      value={state.maxZoom}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
          {!state.geostats && (
            <div className="space-x-2">
              <input
                type="submit"
                disabled={state.evaluating}
                value={t("Evaluate service")}
                className={`p-1.5 bg-primary-500 text-white border shadow-sm rounded cursor-pointer text-sm ${
                  state.evaluating ? "opacity-50" : ""
                }`}
              />
            </div>
          )}
          {state.evaluating && state.progressMessage && (
            <div className="flex items-center text-sm space-x-4 border rounded p-2 bg-gray-50">
              <Spinner large />
              <div>
                <span>{state.progressMessage}</span>
                {/valid tiles/.test(state.progressMessage) && (
                  <div>
                    {t(
                      "You can speed up the process of finding tileset boundaries by moving the map to the approximate location of the dataset."
                    )}
                    <br />
                    <button
                      className="text-primary-500 underline"
                      onClick={() => {
                        state.abortController?.abort();
                      }}
                    >
                      {t("Cancel")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </form>
        {state.geostats && state.canImport && (
          <button
            className={`bg-primary-500 text-white rounded shadow-sm p-2 flex items-center space-x-2 ${
              mutationState.loading || state.selectedLayers.length === 0
                ? "opacity-50 pointer-events-none"
                : ""
            }`}
            // loading={mutationState.loading}
            disabled={state.selectedLayers.length === 0}
            // disabled={!canImport}
            onClick={() => {
              const form = document.getElementById(
                "remote-mvt-form"
              ) as HTMLFormElement;
              if (!form) {
                alert("Form not found");
                return;
              }
              const formData = new FormData(form);
              const url = formData.get("urlTemplate") as string;
              if (state.error?.length) {
                alert(state.error);
                return;
              }
              if (!projectId) {
                alert("Project not found");
                return;
              }
              mutate({
                variables: {
                  url,
                  minZoom: state.minZoom,
                  maxZoom: state.maxZoom,
                  sourceLayers: state.selectedLayers,
                  projectId,
                  geostats: state.geostats!,
                  bounds: state.bounds,
                  featureBounds: state.featureBounds,
                },
              }).then((response) => {
                if (
                  (
                    response.data?.createRemoteMvtSource
                      ?.tableOfContentsItems || []
                  ).length
                ) {
                  if (mapContext.manager) {
                    mapContext.manager.showTocItems(
                      response.data!.createRemoteMvtSource!.tableOfContentsItems!.map(
                        (t) => {
                          return t.stableId;
                        }
                      )
                    );
                  }
                }
                onRequestClose();
              });
            }}
          >
            <span>
              {state.selectedLayers.length < 2
                ? t("Import layer")
                : t(`Import ${state.selectedLayers.length} layers`)}
            </span>
            {mutationState.loading && <Spinner color="white" />}
          </button>
        )}
      </div>
    </AddRemoteServiceMapModal>
  );
}

function validateUrl(url: string) {
  const validationErrors: string[] = [];
  if (url.length === 0) {
    validationErrors.push("URL is required");
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      validationErrors.push("URL must be https");
    }
    if (!/\{x\}/.test(url)) {
      validationErrors.push("Missing {x} parameter");
    }
    if (!/\{y\}/.test(url)) {
      validationErrors.push("Missing {y} parameter");
    }
    if (!/\{z\}/.test(url)) {
      validationErrors.push("Missing {z} parameter");
    }
  } catch (e) {
    validationErrors.push("Invalid URL");
  }
  return validationErrors;
}

function setValidationMessage(input: HTMLInputElement, message: string) {
  if (input.validationMessage !== message) {
    input.setCustomValidity(message);
    input.reportValidity();
  }
}

function getGLStyleLayers(
  geostats: Geostats,
  source: string,
  sourceLayer: string
) {
  const geostatsLayer = geostats.layers.find((l) => l.layer === sourceLayer);
  if (!geostatsLayer) {
    throw new Error("Layer not found in geostats");
  }
  const layers: mapboxgl.AnyLayer[] = [];
  switch (geostatsLayer.geometry) {
    case "Point":
    case "MultiPoint":
      layers.push({
        // eslint-disable-next-line i18next/no-literal-string
        id: `mvt-${sourceLayer}-points`,
        type: "circle",
        source,
        "source-layer": sourceLayer,
        paint: {
          "circle-radius": 2,
          "circle-color": "#0a0",
          "circle-stroke-color": "#000",
        },
        filter: ["==", "$type", "Point"],
      });
      break;
    case "LineString":
    case "MultiLineString":
      layers.push({
        // eslint-disable-next-line i18next/no-literal-string
        id: `mvt-${sourceLayer}-lines`,
        type: "line",
        source,
        "source-layer": sourceLayer,
        paint: {
          "line-color": "#8a0",
          "line-width": 1,
        },
        filter: ["==", "$type", "LineString"],
      });
      break;
    case "MultiPolygon":
    case "Polygon":
    case "GeometryCollection":
      layers.push({
        // eslint-disable-next-line i18next/no-literal-string
        id: `mvt-${sourceLayer}-polygons`,
        type: "fill",
        source,
        "source-layer": sourceLayer,
        paint: {
          "fill-color": "#0a0",
          "fill-outline-color": "#000",
          "fill-opacity": 0.8,
        },
        filter: ["==", "$type", "Polygon"],
      });
      break;
    default:
      layers.push({
        // eslint-disable-next-line i18next/no-literal-string
        id: `mvt-${sourceLayer}-lines-blur`,
        type: "line",
        source,
        "source-layer": sourceLayer,
        paint: {
          "line-color": "#0a0",
          "line-width": 5,
          "line-blur": 5,
        },
        filter: ["==", "$type", "LineString"],
      });
      layers.push({
        // eslint-disable-next-line i18next/no-literal-string
        id: `mvt-${sourceLayer}-lines`,
        type: "line",
        source,
        "source-layer": sourceLayer,
        paint: {
          "line-color": "#8a0",
          "line-width": 1,
        },
        filter: ["==", "$type", "LineString"],
      });
  }
  return layers;
}

/**
 * Attempts to determine details of the MVT service such that a good
 * source configuration can be created.
 * @param url
 */
export async function evaluateMVTUrlTemplate(
  url: string,
  hintBounds: number[],
  signal: AbortSignal,
  onProgress?: (
    message: string,
    geostats: Geostats,
    minZoom: number,
    maxZoom: number,
    tile?: number[]
  ) => void
): Promise<{
  bounds?: number[];
  minZoom?: number;
  maxZoom?: number;
  geostats: Geostats;
  roughFeatureBounds: number[];
}> {
  const geostats: Geostats = {
    layerCount: 0,
    layers: [],
  };
  let tileRequests = 0;
  // Use tilebelt to find the first tile which is not 404
  // Use that tile to determine the bounds and minZoom
  const failedTiles = new Set<string>();
  const progressHandler = onProgress
    ? (tile: number[]) => {
        onProgress(
          // eslint-disable-next-line i18next/no-literal-string
          `Looking for valid tiles. ${tileRequests++} requests.`,
          geostats,
          0,
          0,
          tile
        );
      }
    : undefined;

  let firstTile: number[] | undefined = undefined;
  let response: Response | undefined;
  let error: string | undefined;
  // First, see if it's a global dataset with a quick query of levels 0-1
  // That's just 5 tiles to check
  const globalSearch = await findTopTile(
    url,
    signal,
    [0, 0, 0],
    failedTiles,
    1,
    progressHandler
  );
  if (globalSearch.firstTile) {
    firstTile = globalSearch.firstTile;
    response = globalSearch.response!;
  } else {
    error = globalSearch.errorMessage;
    // If not a global dataset or tiled up to zoom 1, try looking in the
    // current viewport
    const viewportSearch = await findTopTile(
      url,
      signal,
      tilebelt.bboxToTile(hintBounds),
      failedTiles,
      2,
      progressHandler
    );
    if (viewportSearch.firstTile) {
      firstTile = viewportSearch.firstTile;
      response = viewportSearch.response!;
    } else {
      error = viewportSearch.errorMessage;
      // As a last resort, search globally down to zoom level 5
      const deepSearch = await findTopTile(
        url,
        signal,
        [0, 0, 0],
        failedTiles,
        5,
        progressHandler
      );
      if (deepSearch.firstTile) {
        firstTile = deepSearch.firstTile;
        response = deepSearch.response!;
      } else {
        error = deepSearch.errorMessage;
        throw new Error(
          `Could not find a valid tile. Last error from the server was:\n${error}`
        );
      }
    }
  }

  if (signal.aborted) {
    throw new Error("Aborted");
  }

  const firstTileResponseData = await response.arrayBuffer();
  addTileToGeostats(geostats, firstTileResponseData);
  let nextTile = firstTile as number[] | null;
  let maxZoom = firstTile[2];
  // find the deepest zoom level
  while (nextTile && nextTile[2] <= 18) {
    if (signal.aborted) {
      throw new Error("Aborted");
    }
    maxZoom = nextTile[2];
    const children = tilebelt.getChildren(nextTile);
    nextTile = null;
    for (const child of children) {
      const tileUrl = url
        .replace("{z}", child[2].toString())
        .replace("{x}", child[0].toString())
        .replace("{y}", child[1].toString());
      const response = await fetch(tileUrl);
      tileRequests++;
      if (response.status === 200) {
        nextTile = child;
        addTileToGeostats(geostats, await response.arrayBuffer());
        if (onProgress) {
          onProgress(
            // eslint-disable-next-line i18next/no-literal-string
            `Searching for max zoom. ${tileRequests} tiles checked.`,
            geostats,
            firstTile[2],
            maxZoom,
            nextTile
          );
        }
        break;
      }
    }
  }

  let roughFeatureBounds = tilebelt.tileToBBOX(firstTile);
  // skip this if it is a global dataset
  if (firstTile.join(",") !== "0,0,0") {
    // calculate rough feature bounds from bbox of all features in first tile
    const tile = new VectorTile(new Protobuf(firstTileResponseData));
    const featureCollection = {
      type: "FeatureCollection",
      features: [] as any[],
    };
    for (const layerId of Object.keys(tile.layers)) {
      for (let i = 0; i < tile.layers[layerId].length; i++) {
        const feature = tile.layers[layerId].feature(i);
        featureCollection.features.push(
          feature.toGeoJSON(firstTile[0], firstTile[1], firstTile[2])
        );
      }
    }
    roughFeatureBounds = bbox(featureCollection);
  }
  return {
    bounds: tilebelt.tileToBBOX(firstTile),
    minZoom: firstTile[2],
    maxZoom,
    geostats,
    roughFeatureBounds,
  };
}

async function fetchTile(
  tile: number[],
  url: string,
  signal: AbortSignal,
  failedTiles: Set<string>
) {
  if (failedTiles.has(tilebelt.tileToQuadkey(tile))) {
    return {
      error: "Tile was previously found to be invalid",
      response: null,
    };
  }
  try {
    const response = await fetch(
      url
        .replace("{z}", tile[2].toString())
        .replace("{x}", tile[0].toString())
        .replace("{y}", tile[1].toString()),
      { signal }
    );
    if (response.status !== 200) {
      failedTiles.add(tilebelt.tileToQuadkey(tile));
    }
    return {
      response,
      error: null,
    };
  } catch (e) {
    failedTiles.add(tilebelt.tileToQuadkey(tile));
    return {
      error: e.message,
      response: null,
    };
  }
}

async function findTopTile(
  url: string,
  signal: AbortSignal,
  startingTile: number[],
  failedTiles: Set<string>,
  depthLimit = 3,
  onProgress?: (tile: number[]) => void
): Promise<{
  firstTile?: number[];
  response?: Response;
  errorMessage?: string;
}> {
  const queue = [] as number[][];
  let latestError: string | undefined = undefined;
  queue.push(startingTile);
  while (queue.length > 0) {
    if (signal.aborted) {
      throw new Error("Aborted");
    }
    const currentTile = queue.shift() as number[];
    const { response, error } = await fetchTile(
      currentTile,
      url,
      signal,
      failedTiles
    );
    if (error) {
      latestError = error;
    }
    onProgress && onProgress(currentTile);
    if (response?.status === 200) {
      let lastSuccessfulResponse = response;
      queue.push(currentTile);
      // See if the tile has any parents which are also valid
      while (queue.length > 0) {
        if (signal.aborted) {
          throw new Error("Aborted");
        }
        const child = queue.pop()!;
        try {
          const parent = tilebelt.getParent(child);
          const tileUrl = url
            .replace("{z}", parent[2].toString())
            .replace("{x}", parent[0].toString())
            .replace("{y}", parent[1].toString());
          const response = await fetch(tileUrl);
          onProgress && onProgress(currentTile);
          if (response.status === 200) {
            lastSuccessfulResponse = response;
            if (parent[2] === 0) {
              return {
                firstTile: parent,
                response: lastSuccessfulResponse,
              };
            } else {
              queue.push(parent);
            }
          } else {
            return {
              firstTile: child,
              response: lastSuccessfulResponse,
            };
          }
        } catch (e) {
          return {
            firstTile: child,
            response: lastSuccessfulResponse,
          };
        }
      }
    } else {
      if (currentTile[2] > startingTile[2] + depthLimit) {
        return {
          errorMessage: latestError,
        };
      } else {
        if (response) {
          latestError = (await response.text()) || response.statusText;
        }
        const children = tilebelt.getChildren(currentTile);
        for (const child of children) {
          queue.push(child);
        }
      }
    }
  }
  return {
    errorMessage: latestError,
  };
}

function addTileToGeostats(geostats: Geostats, data: ArrayBuffer) {
  var tile = new VectorTile(new Protobuf(data));
  for (const id of Object.keys(tile.layers)) {
    let geostatsLayer = geostats.layers.find((l) => l.layer === id);
    if (!geostatsLayer) {
      geostatsLayer = {
        layer: id,
        count: 0,
        // @ts-ignore
        geometry: "Unknown",
        attributeCount: 0,
        attributes: [],
      };
      geostats.layers.push(geostatsLayer!);
      geostats.layerCount++;
    }
    for (var i = 0; i < tile.layers[id].length; i++) {
      var feature = tile.layers[id].feature(i);
      // @ts-ignore
      geostatsLayer!.geometry = VectorTileFeature.types[feature.type];
      for (const key in feature.properties) {
        let attribute = geostatsLayer!.attributes.find(
          (a) => a.attribute === key
        );
        if (!attribute) {
          // @ts-ignore
          attribute = {
            attribute: key,
            count: 0,
            values: [],
          };
          geostatsLayer!.attributes.push(attribute!);
          geostatsLayer!.attributeCount++;
        }
        if (!attribute) {
          throw new Error("attribute not found");
        }
        attribute.count++;
        if (typeof feature.properties[key] === "number") {
          if (attribute.type && attribute.type !== "number") {
            attribute.type = "mixed";
          } else {
            attribute.type = "number";
          }
          if (
            !attribute.max ||
            attribute.max < (feature.properties[key] as number)
          ) {
            attribute.max = feature.properties[key] as number;
          }
          if (
            !attribute.min ||
            attribute.min > (feature.properties[key] as number)
          ) {
            attribute.min = feature.properties[key] as number;
          }
        } else if (typeof feature.properties[key] === "string") {
          if (attribute.type && attribute.type !== "string") {
            attribute.type = "mixed";
          } else {
            attribute.type = "string";
          }
        } else if (typeof feature.properties[key] === "boolean") {
          if (attribute.type && attribute.type !== "boolean") {
            attribute.type = "mixed";
          } else {
            attribute.type = "boolean";
          }
        } else if (feature.properties[key] === null) {
          if (attribute.type && attribute.type !== "null") {
            attribute.type = "mixed";
          } else {
            attribute.type = "null";
          }
        }
        if (attribute.values.length < 100) {
          if (!attribute.values.includes(feature.properties[key])) {
            attribute.values.push(feature.properties[key]);
          }
        }
      }
    }
  }
}
