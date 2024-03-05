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

export default function AddMVTUrlModal({
  onRequestClose,
}: {
  onRequestClose: () => void;
}) {
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const { t } = useTranslation("admin:data");
  const urlInput = useRef<HTMLInputElement>(null);
  const [wasSubmitted, setWasSubmitted] = useState(false);
  const { alert } = useDialog();
  const [canImport, setCanImport] = useState(false);
  const projectId = useProjectId();

  const onError = useGlobalErrorHandler();
  const [mutate, mutationState] = useCreateMvtSourceMutation({
    onError,
    refetchQueries: [DraftTableOfContentsDocument],
  });

  const onSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      if (form && urlInput.current) {
        setWasSubmitted(true);
        const formData = new FormData(form);
        const url = formData.get("urlTemplate") as string;
        const validationErrors = validateUrl(url);
        if (validationErrors.length) {
          setValidationMessage(urlInput.current, validationErrors.join("\n"));
          setCanImport(false);
        } else {
          evaluateMVTUrlTemplate(url).then((result) => {
            console.log("result", result);
          });
          setValidationMessage(urlInput.current, "");
          // Add to map
          if (map) {
            setCanImport(true);
            // reset map
            map.setStyle(STYLE);

            setTimeout(() => {
              const sourceId = uuid();
              map.addSource(sourceId, {
                type: "vector",
                tiles: [url],
                maxzoom: parseInt((formData.get("max-zoom") as string) || "0"),
                minzoom: parseInt((formData.get("min-zoom") as string) || "0"),
              });
              for (const layer of getGLStyleLayers(
                sourceId,
                formData.get("source-layer") as string
              )) {
                map.addLayer(layer);
              }
            }, 100);
          } else {
            alert("Map not ready");
          }
        }
      }
    },
    [setWasSubmitted, map, alert, urlInput]
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
      if (wasSubmitted && urlInput.current) {
        const form = e.currentTarget;
        const formData = new FormData(form);
        const url = formData.get("urlTemplate") as string;
        const validationErrors = validateUrl(url);
        if (validationErrors.length) {
          setValidationMessage(urlInput.current, validationErrors.join("\n"));
          setCanImport(false);
        } else {
          setValidationMessage(urlInput.current, "");
        }
      }
    },
    [urlInput, wasSubmitted]
  );

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
            type="text"
            required
            className="w-full border-gray-300 rounded-md focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5 text-black"
          />
          <div className="flex space-x-4">
            <div className="">
              <label
                htmlFor="min-zoom"
                className="block text-sm font-medium leading-5 text-gray-800"
              >
                {t("Min Zoom")}
              </label>
              <input
                className=" border-gray-300 rounded-md focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5 text-black"
                name="min-zoom"
                type="number"
                min={0}
                max={12}
                defaultValue={0}
              />
            </div>
            <div>
              <label
                htmlFor="max-zoom"
                className="block text-sm font-medium leading-5 text-gray-800"
              >
                {t("Max Zoom")}
              </label>
              <input
                className=" border-gray-300 rounded-md focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5 text-black"
                name="max-zoom"
                type="number"
                min={0}
                max={18}
                defaultValue={0}
              />
            </div>
          </div>
          <label
            htmlFor="source-layer"
            className="block text-sm font-medium leading-5 text-gray-800"
          >
            {t("Source Layer")}
            <a
              href="https://docs.mapbox.com/style-spec/reference/layers/#source-layer"
              target="_blank"
            >
              <InfoCircledIcon className="inline ml-1" />
            </a>
          </label>
          <input
            required
            name="source-layer"
            type="text"
            className="w-full border-gray-300 rounded-md focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5 text-black"
          />
          <div className="space-x-2">
            <input
              type="submit"
              value={t("Show on Map")}
              className="p-1.5 bg-primary-500 text-white border shadow-sm rounded cursor-pointer text-sm"
            />
          </div>
        </form>
        <Button
          // loading={mutationState.loading}
          label={t("Import into project")}
          // disabled={!canImport}
          onClick={() => {
            console.log("onClick");
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
            const minZoom = parseInt(formData.get("min-zoom") as string);
            const maxZoom = parseInt(formData.get("max-zoom") as string);
            const sourceLayer = formData.get("source-layer") as string;
            if (!projectId) {
              alert("Project not found");
              return;
            }
            mutate({
              variables: {
                url,
                minZoom,
                maxZoom,
                sourceLayer,
                projectId,
                title: sourceLayer,
                stableId: generateStableId(),
                mapboxGlStyles: getGLStyleLayers(uuid(), sourceLayer).map(
                  (l) => {
                    const layer = {
                      ...l,
                    } as any;
                    delete layer.id;
                    delete layer.source;
                    delete layer["source-layer"];
                    return layer;
                  }
                ),
              },
            });
          }}
        />
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

function getGLStyleLayers(source: string, sourceLayer: string) {
  const layers: mapboxgl.AnyLayer[] = [];
  layers.push({
    // eslint-disable-next-line i18next/no-literal-string
    id: `${sourceLayer}-points-blur`,
    type: "circle",
    source,
    "source-layer": sourceLayer,
    paint: {
      "circle-radius": 8,
      "circle-color": "#0a0",
      "circle-blur": 2,
    },
    filter: ["==", "$type", "Point"],
  });
  layers.push({
    // eslint-disable-next-line i18next/no-literal-string
    id: `${sourceLayer}-points`,
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
  layers.push({
    // eslint-disable-next-line i18next/no-literal-string
    id: `${sourceLayer}-lines-blur`,
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
    id: `${sourceLayer}-lines`,
    type: "line",
    source,
    "source-layer": sourceLayer,
    paint: {
      "line-color": "#8a0",
      "line-width": 1,
    },
    filter: ["==", "$type", "LineString"],
  });
  layers.push({
    // eslint-disable-next-line i18next/no-literal-string
    id: `${sourceLayer}-polygons`,
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
  return layers;
}

/**
 * Attempts to determine details of the MVT service such that a good
 * source configuration can be created.
 * @param url
 */
async function evaluateMVTUrlTemplate(url: string): Promise<{
  bounds?: number[];
  minZoom?: number;
  maxZoom?: number;
  sourceLayers: string[];
}> {
  // Use tilebelt to find the first tile which is not 404
  // Use that tile to determine the bounds and minZoom
  const wholeEarthTile = [0, 0, 0];
  let currentTile = wholeEarthTile;
  let biggestTile: null | number[] = null;
  while (!biggestTile && currentTile[2] < 5) {
    console.log("check tile", currentTile);
    const tileUrl = url
      .replace("{z}", currentTile[2].toString())
      .replace("{x}", currentTile[0].toString())
      .replace("{y}", currentTile[1].toString());
    const response = await fetch(tileUrl);
    if (response.status !== 404) {
      biggestTile = currentTile;
    } else {
      const children = tilebelt.getChildren(currentTile);
      currentTile = children[0];
    }
  }
  let nextTile = biggestTile;
  let maxZoom = biggestTile ? biggestTile[2] : undefined;
  // find the deepest zoom level
  while (nextTile && nextTile[2] <= 18) {
    maxZoom = nextTile[2];
    const children = tilebelt.getChildren(nextTile);
    nextTile = null;
    for (const child of children) {
      console.log("checking tile", child);
      const tileUrl = url
        .replace("{z}", child[2].toString())
        .replace("{x}", child[0].toString())
        .replace("{y}", child[1].toString());
      const response = await fetch(tileUrl);
      if (response.status === 200) {
        nextTile = child;
        break;
      }
    }
  }

  return {
    bounds: biggestTile
      ? tilebelt.tileToBBOX(biggestTile)
      : [-180, -85.0511, 180, 85.0511],
    minZoom: biggestTile ? biggestTile[0] : 0,
    maxZoom,
    sourceLayers: [],
  };
}
