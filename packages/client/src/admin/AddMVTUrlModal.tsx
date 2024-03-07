import { Trans, useTranslation } from "react-i18next";
import AddRemoteServiceMapModal, {
  STYLE,
} from "./data/AddRemoteServiceMapModal";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import useDialog from "../components/useDialog";
import { v4 as uuid } from "uuid";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import {
  DraftTableOfContentsDocument,
  useCreateMvtSourceMutation,
} from "../generated/graphql";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import useProjectId from "../useProjectId";
import { generateStableId } from "./data/arcgis/arcgis";
import Button from "../components/Button";
import tilebelt from "@mapbox/tilebelt";
import Protobuf from "pbf";
import { VectorTile, VectorTileFeature } from "@mapbox/vector-tile";
import { Geostats } from "./data/GLStyleEditor/GeostatsModal";
import Spinner from "../components/Spinner";
import Switch from "../components/Switch";
import Warning from "../components/Warning";
import { GeoJSONSource } from "mapbox-gl";

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
  });
  const projectId = useProjectId();

  const onError = useGlobalErrorHandler();
  const [mutate, mutationState] = useCreateMvtSourceMutation({
    onError,
    refetchQueries: [DraftTableOfContentsDocument],
  });

  const onSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      if (form && urlInput.current) {
        setState((s) => ({ ...s, wasSubmitted: true }));
        const formData = new FormData(form);
        const url = formData.get("urlTemplate") as string;
        const validationErrors = validateUrl(url);
        if (validationErrors.length) {
          setValidationMessage(urlInput.current, validationErrors.join("\n"));
          setState((s) => ({ ...s, canImport: false }));
        } else {
          setState({
            ...state,
            evaluating: true,
            progressMessage: "Fetching data...",
            geostats: null,
            error: undefined,
          });
          try {
            if (map) {
              // @ts-ignore
              window.map = map;
              // @ts-ignore
              map.fitBounds(tilebelt.tileToBBOX([0, 0, 0]), {
                // duration: 5000,
                // speed: 0.2,
              });
            }
            const data = await evaluateMVTUrlTemplate(
              url,
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
                        // duration: 5000,
                        speed: 0.2,
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
            });
            if (data.bounds && map) {
              // @ts-ignore
              map.fitBounds(data.bounds, { padding: 20 });
            }
            setValidationMessage(urlInput.current, "");
            // Add to map
            if (map) {
              setState((s) => ({ ...s, canImport: true }));
              const sourceId = uuid();
              map.addSource(sourceId, {
                type: "vector",
                tiles: [url],
                maxzoom: state.maxZoom,
                minzoom: state.minZoom,
              });
              for (const sourceLayer of state.geostats?.layers.map(
                (l) => l.layer
              ) || []) {
                for (const layer of getGLStyleLayers(
                  state.geostats!,
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
            setState({
              ...state,
              evaluating: false,
              geostats: null,
              error: e.message,
            });
          }
        }
      }
    },
    [setState, map, alert, urlInput]
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

  const resetMap = useCallback(() => {
    return new Promise((resolve) => {
      if (map) {
        map.once("render", (e) => {
          const map = e.target;
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
              id: "search-tile-line",
              type: "line",
              source: "search-tile",
              paint: {
                "line-color": "rgb(128, 255, 57)",
                "line-width": 5,
                "line-blur": 1,
              },
            });
          }
          resolve(null);
        });
        map.setStyle(STYLE);
      } else {
        console.log("resolving with no map");
        resolve(null);
      }
    });
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
    [urlInput, setState, state.geostats, state.wasSubmitted]
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
      onMapLoad={setMap}
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
            of the vector tile service above, with placeholders for {`{z}`},{" "}
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
                    <div className="flex">
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
            <div className="flex items-center text-sm space-x-3 border rounded p-2 bg-gray-50">
              <Spinner />
              <span>{state.progressMessage}</span>
            </div>
          )}
        </form>
        {state.geostats && state.canImport && (
          <Button
            primary
            loading={mutationState.loading}
            disabled={state.selectedLayers.length === 0}
            label={
              state.selectedLayers.length < 2
                ? t("Import layer")
                : t(`Import ${state.selectedLayers.length} layers`)
            }
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
              const errors = validateUrl(url);
              if (errors.length) {
                alert(errors.join("\n"));
                return;
              }
              if (!projectId) {
                alert("Project not found");
                return;
              }
              const sourceLayer = state.selectedLayers[0];
              mutate({
                variables: {
                  url,
                  minZoom: state.minZoom,
                  maxZoom: state.maxZoom,
                  sourceLayer,
                  projectId,
                  title: sourceLayer,
                  stableId: generateStableId(),
                  mapboxGlStyles: getGLStyleLayers(
                    state.geostats!,
                    uuid(),
                    sourceLayer
                  ).map((l) => {
                    const layer = {
                      ...l,
                    } as any;
                    delete layer.id;
                    delete layer.source;
                    delete layer["source-layer"];
                    return layer;
                  }),
                },
              });
            }}
          />
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
}> {
  const geostats: Geostats = {
    layerCount: 0,
    layers: [],
  };
  let tileRequests = 0;
  // Use tilebelt to find the first tile which is not 404
  // Use that tile to determine the bounds and minZoom
  const [firstTile, response] = await findFirstTile(
    url,
    (requests, z, tile) => {
      tileRequests = requests;
      if (onProgress) {
        onProgress(
          // eslint-disable-next-line i18next/no-literal-string
          `Searching for first tile. ${requests} requests. z=${z}`,
          geostats,
          0,
          0,
          tile
        );
      }
    }
  );
  console.log("firstTile", firstTile);
  addTileToGeostats(geostats, await response.arrayBuffer());
  let nextTile = firstTile as number[] | null;
  let maxZoom = firstTile[2];
  // find the deepest zoom level
  while (nextTile && nextTile[2] <= 18) {
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
            `Searching for max zoom. ${tileRequests} tiles accessed. z=${child[2]}`,
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

  return {
    bounds: tilebelt.tileToBBOX(firstTile),
    minZoom: firstTile[2],
    maxZoom,
    geostats,
  };
}

async function findFirstTile(
  url: string,
  onProgress?: (requests: number, z: number, tile: number[]) => void,
  queue = [[0, 0, 0]] as number[][],
  latestError?: string
): Promise<[number[], Response]> {
  let numberOfRequests = 0;
  while (queue.length > 0) {
    const currentTile = queue.shift() as number[];
    const tileUrl = url
      .replace("{z}", currentTile[2].toString())
      .replace("{x}", currentTile[0].toString())
      .replace("{y}", currentTile[1].toString());
    const response = await fetch(tileUrl);
    onProgress && onProgress(numberOfRequests++, currentTile[2], currentTile);
    if (response.status === 200) {
      return [currentTile, response];
    } else {
      if (currentTile[2] > 5) {
        throw new Error("Could not find a valid tile. " + latestError);
      } else {
        latestError = (await response.text()) || response.statusText;
        const children = tilebelt.getChildren(currentTile);
        for (const child of children) {
          queue.push(child);
        }
      }
    }
  }
  throw new Error("Could not find a valid tile. " + latestError);
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
