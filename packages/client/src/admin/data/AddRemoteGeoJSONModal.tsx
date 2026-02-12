import { Map } from "mapbox-gl";
import { FormEvent, useCallback, useContext, useRef, useState } from "react";
import AddRemoteServiceMapModal from "./AddRemoteServiceMapModal";
import { Trans, useTranslation } from "react-i18next";
import Warning from "../../components/Warning";
import bytes from "bytes";
import parseCacheControl from "parse-cache-control";
import GeostatsModal, { Geostats } from "./GLStyleEditor/GeostatsModal";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import {
  DraftTableOfContentsDocument,
  useCreateRemoteGeoJsonSourceMutation,
} from "../../generated/graphql";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import getSlug from "../../getSlug";
import { MapManagerContext } from "../../dataLayers/MapContextManager";
import Spinner from "../../components/Spinner";
import { GeostatsLayer } from "@seasketch/geostats-types";

interface BaseInspectorResponse {
  location: string;
}

interface FailedInspectorResponse extends BaseInspectorResponse {
  error: string;
}

interface SuccessfulInspectorResponse extends BaseInspectorResponse {
  contentType?: string;
  cacheControl?: string;
  geometryType: string;
  latency?: number;
  featureCount: number;
  geostats: GeostatsLayer;
  contentLength?: number;
  bbox: number[];
}

type InspectorResponse = FailedInspectorResponse | SuccessfulInspectorResponse;

function isFailedInspectorResponse(
  response: InspectorResponse
): response is FailedInspectorResponse {
  return (response as FailedInspectorResponse).error !== undefined;
}

export default function AddRemoteGeoJSONModal({
  onRequestClose,
}: {
  onRequestClose: () => void;
}) {
  const [map, setMap] = useState<Map | null>(null);
  const urlInput = useRef<HTMLInputElement>(null);
  const [state, setState] = useState({
    evaluating: false,
    error: null as string | null,
    data: null as SuccessfulInspectorResponse | null,
    warning: null as string | null,
  });
  const { t } = useTranslation("admin:data");
  const [attributesModalOpen, setAttributesModalOpen] = useState(false);
  const onError = useGlobalErrorHandler();
  const [mutation, mutationState] = useCreateRemoteGeoJsonSourceMutation({
    onError,
    refetchQueries: [
      {
        query: DraftTableOfContentsDocument,
        variables: {
          slug: getSlug(),
        },
      },
    ],
  });
  const { manager } = useContext(MapManagerContext);

  const onSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      setState((s) => ({ ...s, evaluating: true, error: null, data: null }));
      e.preventDefault();
      try {
        new URL(urlInput.current!.value);
        try {
          const response = await fetch(
            `https://geojson-inspector.seasketch.org/?location=${
              urlInput.current!.value
            }`
          );
          const json: InspectorResponse = await response.json();
          if (isFailedInspectorResponse(json)) {
            setState((prev) => ({
              ...prev,
              evaluating: false,
              error: json.error,
            }));
            return;
          } else {
            if (map) {
              if (map.getSource("remote-geojson")) {
                map.removeLayer("remote-geojson");
                map.removeSource("remote-geojson");
              }
              // Add the geojson source to the map with a generic style
              map.addSource("remote-geojson", {
                type: "geojson",
                data: urlInput.current!.value,
              });
              switch (json.geometryType) {
                case "Point":
                case "MultiPoint":
                  map.addLayer({
                    id: "remote-geojson",
                    type: "circle",
                    source: "remote-geojson",
                    paint: {
                      "circle-radius": 5,
                      "circle-color": "#8a0",
                      "circle-stroke-color": "black",
                      "circle-stroke-width": 1,
                    },
                  });
                  break;
                case "LineString":
                case "MultiLineString":
                  map.addLayer({
                    id: "remote-geojson",
                    type: "line",
                    source: "remote-geojson",
                    paint: {
                      "line-color": "#8a0",
                      "line-width": 1,
                    },
                  });
                  break;
                case "Polygon":
                case "MultiPolygon":
                  map.addLayer({
                    id: "remote-geojson",
                    type: "fill",
                    source: "remote-geojson",
                    paint: {
                      "fill-color": "#8a0",
                      "fill-opacity": 0.8,
                    },
                  });
                  break;
              }

              // @ts-ignore
              map.fitBounds(json.bbox, { padding: 250 });
            }
            let warning: string | null = null;
            if (json.geometryType === "GeometryCollection") {
              warning = t(
                "This GeoJSON contains a GeometryCollection. It may not render as expected."
              );
            } else if (json.contentLength && json.contentLength > 1000000) {
              warning = t(
                "This GeoJSON is over 1MB and may take a long time to load. Consider downloading the data and uploading to SeaSketch so that it can be tiled."
              );
            } else if (json.latency && json.latency > 2000) {
              warning = t(
                "This GeoJSON took over 2 seconds to load. Consider downloading the data and uploading to SeaSketch for better performance."
              );
            } else if (json.cacheControl) {
              const parsed = parseCacheControl(json.cacheControl);
              if (
                parsed?.["no-cache"] ||
                parsed?.["no-store"] ||
                parsed?.private
              ) {
                warning = t(
                  "This response contains cache directives instructing users to re-download the dataset each time it is displayed. Consider using long-lived cache headers to improve performance."
                );
              } else if (parsed?.["max-age"] && parsed["max-age"] < 3600) {
                warning = t(
                  `This response contains cache directives to re-download the dataset after a short period of time (${
                    parsed["max-age"] / 60
                  } minutes). Consider using long-lived cache headers to improve performance.`
                );
              }
            }

            setState((prev) => ({
              ...prev,
              evaluating: false,
              data: json,
              warning,
            }));
          }
        } catch (e) {
          setState((prev) => ({
            ...prev,
            evaluating: false,
            // eslint-disable-next-line i18next/no-literal-string
            error: `Problem inspecting service. ${e.message}`,
          }));
          return;
        }
      } catch (e) {
        setState((prev) => ({
          ...prev,
          evaluating: false,
          error: t("Invalid URL"),
        }));
        return;
      }
    },
    [map, t]
  );

  const geostatsLayer = state.data?.geostats as GeostatsLayer | undefined;

  return (
    <>
      {attributesModalOpen && geostatsLayer && (
        <GeostatsModal
          geostats={{
            layerCount: 1,
            layers: [geostatsLayer],
          }}
          onRequestClose={() => setAttributesModalOpen(false)}
        />
      )}

      <AddRemoteServiceMapModal
        title={t("Add Remote GeoJSON")}
        onRequestClose={onRequestClose}
        onMapLoad={setMap}
      >
        {state.data && (
          <div className="z-10 absolute right-2 top-2 space-x-1 text-sm max-w-1/2 xl:max-w-2xl overflow-x-hidden">
            {state.data.contentLength && (
              <InfoPill>
                {/* eslint-disable-next-line i18next/no-literal-string */}
                {bytes(state.data.contentLength)}
              </InfoPill>
            )}
            {state.data.latency && (
              <InfoPill>
                <Trans ns="admin:data">latency: </Trans>
                {/* eslint-disable-next-line i18next/no-literal-string */}
                {state.data.latency} ms
              </InfoPill>
            )}
            {state.data?.cacheControl && (
              <InfoPill>
                <Trans ns="admin:data">cache-control: </Trans>
                {state.data.cacheControl}
              </InfoPill>
            )}
            {state.data.geometryType && (
              <InfoPill>
                {state.data.geometryType},{" "}
                {state.data.featureCount === 1 ? (
                  <span>
                    {state.data.featureCount}{" "}
                    <Trans ns="admin:data">feature</Trans>
                  </span>
                ) : (
                  <span>
                    {state.data.featureCount}{" "}
                    <Trans ns="admin:data">features</Trans>
                  </span>
                )}
              </InfoPill>
            )}
            {geostatsLayer && (
              <InfoPill>
                <button
                  onClick={() => {
                    setAttributesModalOpen(true);
                  }}
                >
                  {geostatsLayer.attributes.length}
                  <Trans ns="admin:data"> attributes</Trans>
                  <InfoCircledIcon className="inline ml-1" />
                </button>
              </InfoPill>
            )}
          </div>
        )}
        <div className="p-4 space-y-4 max-h-full overflow-y-auto">
          <p className="text-sm">
            <Trans ns="admin:data">
              If you have{" "}
              <a
                href="https://geojson.org/"
                target="_blank"
                className="text-primary-500 hover:underline"
              >
                GeoJSON
              </a>{" "}
              hosted publicly on the web you can add a dynamic link to it here.
              Changes to the GeoJSON will be reflected on the map in real time
              depending on cache headers set by the remote server. Styling can
              be set after import.
            </Trans>
          </p>
          <div>
            <form className="space-y-2" onSubmit={onSubmit}>
              <label
                htmlFor="url"
                className="block text-sm font-medium leading-5 text-gray-800 required"
              >
                {t("GeoJSON Location")}
              </label>
              <input
                ref={urlInput}
                name="url"
                placeholder="https://example.com/data.json"
                type="text"
                required
                onChange={(e) => {
                  if (state.data && e.target.value !== state.data.location) {
                    setState((prev) => ({
                      ...prev,
                      data: null,
                      error: null,
                      warning: null,
                    }));
                  }
                }}
                disabled={state.evaluating}
                className={`w-full border-gray-300 rounded-md focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5 text-black ${
                  state.evaluating || mutationState.loading
                    ? "opacity-50 pointer-events-none"
                    : ""
                }`}
              />
              {state.error && <Warning level="error">{state.error}</Warning>}
              {state.warning && (
                <Warning level="warning">{state.warning}</Warning>
              )}
              <div className="space-x-2">
                <input
                  type="submit"
                  disabled={Boolean(state.data) && !state.error}
                  value={t("Submit")}
                  className={`p-1.5 bg-primary-500 text-white border shadow-sm rounded cursor-pointer text-sm ${
                    (Boolean(state.data) && !state.error) ||
                    mutationState.loading
                      ? "opacity-50 pointer-events-none"
                      : ""
                  }`}
                />
                {Boolean(state.data) && !state.error && (
                  <button
                    onClick={() => {
                      if (!state.data?.geostats || !state.data.location) {
                        throw new Error("Not ready");
                      }
                      const geostats: Geostats = {
                        layerCount: 1,
                        layers: [state.data.geostats],
                      };
                      mutation({
                        variables: {
                          url: state.data.location,
                          geostats,
                          slug: getSlug(),
                          bounds: state.data.bbox,
                        },
                        awaitRefetchQueries: true,
                      }).then((response) => {
                        if (
                          response.data?.createRemoteGeojsonSource
                            ?.tableOfContentsItem
                        ) {
                          const stableId =
                            response.data!.createRemoteGeojsonSource!
                              .tableOfContentsItem.stableId;
                          if (manager) {
                            manager.showTocItems([stableId]);
                            setTimeout(() => {
                              manager?.zoomToTocItem(stableId);
                            }, 200);
                          }
                        }
                        onRequestClose();
                      });
                    }}
                    className={`p-1.5 inline-flex items-center space-x-2  border shadow-sm rounded cursor-pointer text-sm ${
                      state.evaluating || mutationState.loading
                        ? "opacity-50 pointer-events-none"
                        : ""
                    }`}
                  >
                    <span>
                      <Trans ns="admin:data">Import layer</Trans>
                    </span>
                    {mutationState.loading && <Spinner />}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </AddRemoteServiceMapModal>
    </>
  );
}

function InfoPill({ children }: { children: React.ReactNode }) {
  return (
    <div className=" bg-black bg-opacity-40 text-indigo-100 px-2 py-0.5 rounded truncate float-right my-1">
      {children}
    </div>
  );
}
