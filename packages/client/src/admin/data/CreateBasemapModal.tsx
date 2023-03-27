import { ApolloCache, gql } from "@apollo/client";
import { Map, Style } from "mapbox-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import { Link } from "react-router-dom";
import Button from "../../components/Button";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import ModalDeprecated from "../../components/ModalDeprecated";
import Spinner from "../../components/Spinner";
import TextInput from "../../components/TextInput";
import {
  BasemapType,
  useCreateBasemapMutation,
  useUpdateInteractivitySettingsLayersMutation,
  useUpdateInteractivitySettingsMutation,
  BasemapDetailsFragment,
  useUploadBasemapMutation,
} from "../../generated/graphql";
import { useMapboxStyle } from "../../useMapboxStyle";
import useProjectId from "../../useProjectId";
import { createImageBlobFromDataURI } from "./arcgis/arcgis";
import useMapboxAccountStyles from "./useMapboxAccountStyles";
import Fuse from "fuse.js";
import { SearchIcon, UploadIcon } from "@heroicons/react/outline";
import { useDropzone } from "react-dropzone";
import { FixedSizeList as List, FixedSizeListProps } from "react-window";

const THUMBNAIL_SIZE = 240;
const IMAGE_SIZE = THUMBNAIL_SIZE * window.devicePixelRatio;

enum TABS {
  UPLOAD,
  URL,
  ACCOUNT,
}

export default function CreateBasemapModal({
  onSave,
  onRequestClose,
  surveysOnly,
}: {
  onSave?: (id: number) => void;
  onRequestClose?: () => void;
  surveysOnly?: boolean;
}) {
  const projectId = useProjectId();
  const { styles, loading, error } = useMapboxAccountStyles();
  // const { styles, loading, error } = data;
  const { t } = useTranslation("admin");
  const Tabs = [
    { name: t("By URL"), id: TABS.URL },
    { name: t("Upload"), id: TABS.UPLOAD },
    { name: t("From Mapbox Account"), id: TABS.ACCOUNT },
  ];
  const [query, setQuery] = useState("");

  const [state, setState] = useState<{
    type: BasemapType;
    name: string;
    description?: string;
    url: string;
    styleJson?: Style;
    mapPreview: boolean;
    selectedTab: TABS;
  }>({
    type: BasemapType.Mapbox,
    name: "",
    url: "",
    mapPreview: false,
    selectedTab: TABS.ACCOUNT,
  });

  const updater = useCallback(
    (cache: ApolloCache<any>, newBasemapData: BasemapDetailsFragment) => {
      cache.modify({
        id: cache.identify({
          __typename: "Project",
          id: projectId,
        }),
        fields: {
          basemaps(existingBasemapRefs = [], { readField }) {
            if (!newBasemapData.surveysOnly) {
              const newBasemapRef = cache.writeFragment({
                data: newBasemapData,
                fragment: gql`
                  fragment NewBasemap on Basemap {
                    id
                    projectId
                    attribution
                    description
                    labelsLayerId
                    name
                    terrainExaggeration
                    terrainOptional
                    url
                    type
                    tileSize
                    thumbnail
                    terrainUrl
                    terrainTileSize
                    surveysOnly
                  }
                `,
              });

              return [...existingBasemapRefs, newBasemapRef];
            } else {
              return existingBasemapRefs;
            }
          },
          surveyBasemaps(existingBasemapRefs = [], { readField }) {
            if (newBasemapData.surveysOnly) {
              const newBasemapRef = cache.writeFragment({
                data: newBasemapData,
                fragment: gql`
                  fragment NewBasemap on Basemap {
                    id
                    projectId
                    attribution
                    description
                    labelsLayerId
                    name
                    terrainExaggeration
                    terrainOptional
                    url
                    type
                    tileSize
                    thumbnail
                    terrainUrl
                    terrainTileSize
                    surveysOnly
                  }
                `,
              });

              return [...existingBasemapRefs, newBasemapRef];
            } else {
              return existingBasemapRefs;
            }
          },
        },
      });
    },
    []
  );

  const [mutate, mutationState] = useCreateBasemapMutation({
    update: (cache, { data }) => {
      if (data?.createBasemap?.basemap) {
        const newBasemapData = data.createBasemap.basemap;
        updater(cache, newBasemapData);
      }
    },
  });

  const [upload, uploadState] = useUploadBasemapMutation({
    update: (cache, { data }) => {
      if (data?.uploadStyle) {
        const newBasemapData = data.uploadStyle;
        updater(cache, newBasemapData);
      }
    },
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const onDrop = useCallback(
    async (acceptedFiles) => {
      try {
        const style = JSON.parse(await acceptedFiles[0].text());
        // Do something with the files
        setState((old) => ({ ...old, mapPreview: true, styleJson: style }));
      } catch (e) {
        onError(e);
      }
    },
    [upload]
  );
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const onError = useGlobalErrorHandler();
  const [updateInteractivity, updateInteractivityState] =
    useUpdateInteractivitySettingsMutation({
      onError,
    });

  const [updateLayers, updateLayersState] =
    useUpdateInteractivitySettingsLayersMutation({
      onError,
    });
  const mapboxStyleInfo = useMapboxStyle(
    state.type === BasemapType.Mapbox ? state.url : undefined
  );

  useEffect(() => {
    if (mapboxStyleInfo.data?.name && !state.name) {
      setState((old) => ({
        ...old,
        name: mapboxStyleInfo.data?.name || "",
      }));
    }
  }, [mapboxStyleInfo]);

  const mapRef = useRef<Map>();
  const mapDivRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (state.mapPreview && mapDivRef.current) {
      const map = new Map({
        container: mapDivRef.current,
        style: state.styleJson || state.url,
        attributionControl: false,
        preserveDrawingBuffer: true,
      });
      mapRef.current = map;
    }
    return () => {
      mapRef.current?.remove();
    };
  }, [state.mapPreview]);

  const fuse = useMemo(() => {
    return new Fuse(styles || [], {
      keys: [
        "name",
        "metadata.seasketch:heatmap-project",
        "metadata.seasketch:heatmap-name",
      ],
    });
  }, [styles]);

  const filteredStyles = useMemo(() => {
    if (query && query.length) {
      return fuse.search(query).map((r) => r.item);
    } else {
      return styles || [];
    }
  }, [query, fuse]);

  const Row = ({
    style,
    index,
  }: FixedSizeListProps<any> & { index: number }) => {
    const { id, url, name, image, lastModified } = filteredStyles[index];
    return (
      <button
        style={style}
        key={id}
        className="p-4 flex w-full border-b items-center space-x-2 hover:bg-primary-300 hover:bg-opacity-10"
        onClick={() => {
          setState((prev) => ({
            ...prev,
            url: url,
            name: name!,
            type: BasemapType.Mapbox,
            mapPreview: true,
          }));
        }}
      >
        <img className="w-12 h-12 rounded" src={image} />
        <div className="flex-col justify-start text-left">
          <div className="space-x-2">
            <span className="max-w-sm truncate">{name!}</span>
            <span className="text-gray-500 text-xs font-mono">
              {
                // @ts-ignore
                style.visibility
              }
            </span>
          </div>
          <span className="text-sm text-gray-500">
            <Trans ns="admin:data">Last modified </Trans>
            {lastModified ? formatTimeAgo(lastModified) : "unknown"}
          </span>
        </div>
      </button>
    );
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        width={IMAGE_SIZE}
        height={IMAGE_SIZE}
        style={{ zIndex: 10000, height: THUMBNAIL_SIZE, width: THUMBNAIL_SIZE }}
        className="absolute left-0 top-0 bg-gray-400 hidden"
      ></canvas>
      <ModalDeprecated
        onRequestClose={onRequestClose}
        open={true}
        zeroPadding
        footer={
          <div className="text-right">
            <Button
              onClick={onRequestClose}
              label={t("Cancel")}
              className="mr-2"
            />
            {(state.selectedTab === TABS.URL || state.mapPreview) && (
              <Button
                primary
                onClick={() => {
                  if (state.mapPreview) {
                    const dataUrl = mapRef.current?.getCanvas().toDataURL();
                    const img = new Image();
                    img.src = dataUrl!;
                    img.onload = () => {
                      // TODO: Test using different devicePixelRatio settings
                      const context = canvasRef.current!.getContext("2d");
                      context!.drawImage(
                        img,
                        (img.width - IMAGE_SIZE) / 2,
                        (img.height - IMAGE_SIZE) / 2,
                        IMAGE_SIZE,
                        IMAGE_SIZE,
                        0,
                        0,
                        IMAGE_SIZE,
                        IMAGE_SIZE
                      );
                      context?.save();
                      const cropped = canvasRef.current!.toDataURL();
                      createImageBlobFromDataURI(
                        IMAGE_SIZE,
                        IMAGE_SIZE,
                        cropped
                      )
                        .then((blob) => {
                          if (state.url) {
                            return mutate({
                              variables: {
                                projectId: projectId!,
                                name: state.name,
                                thumbnail: blob,
                                type: state.type,
                                url: state.url,
                                surveysOnly,
                              },
                            });
                          } else {
                            return upload({
                              variables: {
                                projectId: projectId!,
                                name:
                                  state.name ||
                                  (state.styleJson?.name as string),
                                thumbnail: blob,
                                style: state.styleJson,
                                surveysOnly,
                              },
                            });
                          }
                        })
                        .then((d) => {
                          const basemapDetails:
                            | BasemapDetailsFragment
                            | undefined =
                            d?.data?.createBasemap?.basemap ||
                            // @ts-ignore
                            d?.data?.uploadStyle ||
                            undefined;
                          if (d?.errors?.length) {
                            throw new Error(d.errors[0].message);
                          }
                          if (
                            (mapboxStyleInfo.data?.metadata?.[
                              "seasketch:interactivity_settings"
                            ] ||
                              state.styleJson?.metadata[
                                "seasketch:interactivity_settings"
                              ]) &&
                            basemapDetails?.interactivitySettings?.id
                          ) {
                            const settings =
                              mapboxStyleInfo.data?.metadata?.[
                                "seasketch:interactivity_settings"
                              ] ||
                              state.styleJson?.metadata[
                                "seasketch:interactivity_settings"
                              ];
                            const settingsId =
                              basemapDetails.interactivitySettings.id;
                            return updateInteractivity({
                              variables: {
                                id: settingsId,
                                ...settings,
                              },
                            }).then((i) => {
                              return updateLayers({
                                variables: {
                                  id: settingsId,
                                  layers: settings.layers,
                                },
                              }).then((a) => {
                                return basemapDetails;
                              });
                            });
                          } else {
                            return basemapDetails;
                          }
                        })
                        .then((d) => {
                          if (onSave && d) {
                            onSave(d.id);
                          } else if (onSave && d) {
                            onSave(d.id);
                          }

                          if (onRequestClose) {
                            onRequestClose();
                          }
                        })
                        .catch((e) => {
                          alert(e.toString());
                        });
                    };
                  } else {
                    setState((old) => ({ ...old, mapPreview: true }));
                  }
                }}
                label={state.mapPreview ? "Capture and Save" : "Continue"}
                disabled={
                  mutationState.loading ||
                  uploadState.loading ||
                  (!state.url && !state.styleJson)
                }
                loading={mutationState.loading || uploadState.loading}
              />
            )}
          </div>
        }
      >
        {!state.mapPreview && (
          <div className="w-128 max-w-full">
            <h3 className="text-center py-4 pb-1 font-medium text-xl">
              {t("New Map")}
            </h3>
            <p className="text-sm text-gray-500 text-center px-4 py-2">
              <Trans ns="admin:surveys">
                SeaSketch uses{" "}
                <a
                  className="underline"
                  href="https://docs.mapbox.com/mapbox-gl-js/style-spec/"
                  target="_blank"
                >
                  Mapbox Style documents
                </a>{" "}
                to represent basemaps. These can be authored in Mapbox Studio or{" "}
                <a
                  className="underline"
                  target="_blank"
                  href="https://maputnik.github.io/"
                >
                  open source tools
                </a>
                .
              </Trans>
            </p>
            <div className="block">
              <nav
                className="flex space-x-4 w-full justify-center my-2"
                aria-label="Tabs"
              >
                {Tabs.map((tab) => (
                  <button
                    onClick={() => {
                      setState((prev) => ({
                        ...prev,
                        selectedTab: tab.id,
                      }));
                    }}
                    key={tab.id}
                    className={classNames(
                      tab.id === state.selectedTab
                        ? "bg-blue-100 text-blue-700"
                        : "text-gray-500 hover:text-gray-700",
                      "px-3 py-2 font-medium text-sm rounded-md"
                    )}
                    aria-current={
                      tab.id === state.selectedTab ? "page" : undefined
                    }
                  >
                    {tab.name}
                  </button>
                ))}
              </nav>
            </div>
            <div className="p-4">
              {state.selectedTab === TABS.UPLOAD && (
                <div
                  {...getRootProps()}
                  className={`flex h-96 p-12 items-center bg-gray-100 rounded-lg justify-center text-center ${
                    isDragActive
                      ? "border-dashed border-2 rounded-lg border-gray-300 -ml-1.5 mt-1.5 -mb-0.5"
                      : ""
                  }`}
                >
                  <span className="">
                    {!uploadState.loading && (
                      <div className="-mt-10">
                        <UploadIcon className="w-8 h-8 mx-auto mb-8 text-gray-500" />

                        <Trans ns="admin:surveys">
                          Drag and Drop your style JSON here. Uploaded styles
                          will be be publicly hosted but their locations will be
                          unlisted.
                        </Trans>
                      </div>
                    )}
                    {uploadState.loading && (
                      <div className="p-5 flex">
                        <Trans ns="admin:surveys">Uploading style...</Trans>
                        {(uploadState.loading || false) && (
                          <Spinner className="ml-2" />
                        )}
                      </div>
                    )}

                    <input
                      ref={inputRef}
                      // {...getInputProps()}
                      id="upload-style-input"
                      type="file"
                      title="choose"
                      accept="application/json"
                      disabled={uploadState.loading}
                      className="hidden py-2 px-1 text-sm leading-1 font-medium text-gray-700 hover:text-gray-500 focus:outline-none focus:border-blue-300 focus:shadow-outline-blue active:bg-gray-50 active:text-gray-800 transition duration-150 ease-in-out"
                    />

                    {uploadState.error && (
                      <p className="text-red-900">
                        {uploadState.error.message}
                      </p>
                    )}
                  </span>
                </div>
              )}
              {state.selectedTab === TABS.URL && (
                <div className="h-96">
                  <TextInput
                    label={t("Style location")}
                    placeholder={
                      state.type === BasemapType.Mapbox
                        ? "mapbox://styles/mapbox/satellite-v9"
                        : "https://example.com/wms?bbox={bbox-epsg-3857}&request=GetMap&format=image/png&service=WMS&version=1.1.1&srs=EPSG:3857&width=256&height=256&layers=example"
                    }
                    inputChildNode={
                      mapboxStyleInfo.loading ? (
                        <div className="absolute right-2 top-2">
                          <Spinner />
                        </div>
                      ) : null
                    }
                    description={
                      state.type === BasemapType.Mapbox ? (
                        <>
                          {
                            // eslint-disable-next-line i18next/no-literal-string
                            "Enter a "
                          }
                          <code className="bg-gray-100 p-0.5 rounded">
                            {
                              // eslint-disable-next-line i18next/no-literal-string
                              "mapbox://"
                            }
                          </code>
                          {
                            // eslint-disable-next-line i18next/no-literal-string
                            " url or the direct url to a style hosted elsewhere."
                          }
                        </>
                      ) : (
                        <Trans ns="admin">
                          Enter a{" "}
                          <a
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary-500 underline"
                            href="https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#tiled-sources"
                          >
                            url template
                          </a>{" "}
                          the tells SeaSketch how to load a raster tile data
                          source.
                        </Trans>
                      )
                    }
                    name="url"
                    value={state.url}
                    onChange={(url) => {
                      setState((old) => ({
                        ...old,
                        url,
                      }));
                    }}
                  />
                  <div className="mt-4">
                    <TextInput
                      label={t("Map Name")}
                      description={t(
                        "The map name will be automatically assigned from the style json, and can be overidden."
                      )}
                      name="name"
                      value={state.name}
                      onChange={(name) => setState((old) => ({ ...old, name }))}
                    />
                  </div>
                </div>
              )}
              {state.selectedTab === TABS.ACCOUNT && (
                <div className="h-96 overflow-hidden flex-col">
                  {loading && <Spinner />}
                  {error && (
                    <p className="text-center text-sm text-gray-500">
                      {/Key not provided/.test(error) ? (
                        <Trans ns="admin:data">
                          Provide a MapBox Secret Key in your{" "}
                          <Link
                            className="underline text-primary-500"
                            to="../admin"
                          >
                            project settings
                          </Link>{" "}
                          to enable browsing of maps in your account.
                        </Trans>
                      ) : (
                        error.toString()
                      )}
                    </p>
                  )}
                  {!(error && /Key not provided/.test(error)) && (
                    <div className="flex justify-center items-center pb-4">
                      <SearchIcon className="w-5 h-5 text-gray-500 absolute left-24 -mb-2" />
                      <input
                        className="w-3/4 outline-none shadow focus:ring-0 rounded-lg border-gray-300 pl-12 -mb-2"
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                  )}
                  {styles && (
                    <div className="flex-1 overflow-auto h-80 bg-gray-50 rounded">
                      <List
                        height={320}
                        itemCount={filteredStyles.length}
                        itemSize={81}
                        width={480}
                      >
                        {/* @ts-ignore */}
                        {Row}
                      </List>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {state.mapPreview && (
          <>
            <div ref={mapDivRef} className="w-128 h-72 bg-gray-300 relative">
              <div className="absolute w-128 h-72 left-0 top-0 z-10 pointer-events-none flex items-center justify-center">
                <div className="absolute top-0 text-sm bg-yellow-200 px-1">
                  <Trans ns="admin">
                    Create a thumbnail image that best represents this basemap
                  </Trans>
                </div>
                <div
                  className="absolute border border-black border-opacity-50 pointer-events-none rounded-md shadow-2xl select-none"
                  style={{ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE }}
                >
                  &nbsp;
                  <div
                    className="absolute top-0 left-0 border-2 border-white border-opacity-50 pointer-events-none rounded-md select-none"
                    style={{
                      width: THUMBNAIL_SIZE - 2,
                      height: THUMBNAIL_SIZE - 2,
                    }}
                  >
                    &nbsp;
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </ModalDeprecated>
    </>
  );
}

// @ts-ignore
function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

const formatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
});

const DIVISIONS: {
  amount: number;
  name: "seconds" | "minutes" | "hours" | "days" | "weeks" | "months" | "years";
}[] = [
  { amount: 60, name: "seconds" },
  { amount: 60, name: "minutes" },
  { amount: 24, name: "hours" },
  { amount: 7, name: "days" },
  { amount: 4.34524, name: "weeks" },
  { amount: 12, name: "months" },
  { amount: Number.POSITIVE_INFINITY, name: "years" },
];

export function formatTimeAgo(date: Date) {
  let duration = (date.getTime() - new Date().getTime()) / 1000;
  if (Math.abs(duration) < 60) {
    return <Trans ns="admin:data">seconds ago</Trans>;
  }
  for (let i = 0; i <= DIVISIONS.length; i++) {
    const division = DIVISIONS[i];
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.name);
    }
    duration /= division.amount;
  }
}
