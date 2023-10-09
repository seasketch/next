import { useEffect, useMemo, useState, useCallback, useContext } from "react";
import {
  useGetLayerItemQuery,
  useUpdateTableOfContentsItemMutation,
  useUpdateDataSourceMutation,
  RenderUnderType,
  useUpdateLayerMutation,
  DataSourceTypes,
  DataSourceImportTypes,
  useUpdateEnableDownloadMutation,
  useUpdateQueryParametersMutation,
  useUpdateEnableHighDpiRequestsMutation,
} from "../../generated/graphql";
import { useTranslation, Trans } from "react-i18next";
import Spinner from "../../components/Spinner";
import MutableAutosaveInput from "../MutableAutosaveInput";
import { MutableRadioGroup } from "../../components/RadioGroup";
import AccessControlListEditor from "../../components/AccessControlListEditor";
import bytes from "bytes";
import Switch from "../../components/Switch";
import InteractivitySettings from "./InteractivitySettings";
import { gql, useApolloClient } from "@apollo/client";
import useDebounce from "../../useDebounce";
import InputBlock from "../../components/InputBlock";
import GLStyleEditor from "./GLStyleEditor/GLStyleEditor";
import {
  ClipboardCopyIcon,
  DotsHorizontalIcon,
} from "@heroicons/react/outline";
import Tabs, { NonLinkTabItem } from "../../components/Tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../components/Tooltip";
import { copyTextToClipboard } from "../../projects/Forums/InlineAuthorDetails";
import { MapContext } from "../../dataLayers/MapContextManager";
import TranslatedPropControl from "../../components/TranslatedPropControl";

interface LayerTableOfContentsItemEditorProps {
  itemId: number;
  onRequestClose?: () => void;
}

export default function LayerTableOfContentsItemEditor(
  props: LayerTableOfContentsItemEditorProps
) {
  const { t } = useTranslation("admin");
  const { data } = useGetLayerItemQuery({
    variables: {
      id: props.itemId,
    },
  });

  const mapContext = useContext(MapContext);

  const [mutateItem, mutateItemState] = useUpdateTableOfContentsItemMutation({
    onCompleted: (data) => {
      const item = data.updateTableOfContentsItem?.tableOfContentsItem;
      if (item?.geoprocessingReferenceId && mapContext.manager) {
        mapContext.manager.setGeoprocessingReferenceId(
          item.geoprocessingReferenceId,
          item.stableId
        );
      }
    },
  });
  const [mutateSource, mutateSourceState] = useUpdateDataSourceMutation();
  const [updateQueryParameters, updateQueryParametersState] =
    useUpdateQueryParametersMutation();
  const [mutateLayer, mutateLayerState] = useUpdateLayerMutation();
  const [updateGLStyleMutation, updateGLStyleMutationState] =
    useUpdateLayerMutation();
  const [updateEnableDownload, updateEnableDownloadState] =
    useUpdateEnableDownloadMutation();
  const [updateEnableHighDpiRequests] =
    useUpdateEnableHighDpiRequestsMutation();

  const item = data?.tableOfContentsItem;
  const [downloadEnabled, setDownloadEnabled] = useState<boolean>();

  const [showMoreColumns, setShowMoreColums] = useState(false);

  const [style, setStyle] = useState<string>();
  const debouncedStyle = useDebounce(style, 250);

  const client = useApolloClient();
  const layer = item?.dataLayer;
  const source = layer?.dataSource;

  useEffect(() => {
    if (
      item &&
      downloadEnabled !== undefined &&
      downloadEnabled !== item?.enableDownload &&
      !updateEnableDownloadState.loading
    ) {
      updateEnableDownload({
        variables: {
          id: item.id,
          enableDownload: downloadEnabled,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downloadEnabled, item?.enableDownload]);

  useEffect(() => {
    if (debouncedStyle) {
      updateGLStyleMutation({
        variables: {
          id: layer!.id,
          mapboxGlStyles:
            typeof debouncedStyle === "string"
              ? JSON.parse(debouncedStyle)
              : debouncedStyle,
        },
      }).catch((e) => {
        console.error(e);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedStyle]);

  const [selectedTab, setSelectedTab] = useState("settings");

  const tabs: NonLinkTabItem[] = useMemo(() => {
    return [
      {
        name: "Settings",
        id: "settings",
        current: selectedTab === "settings",
      },
      {
        name: "Interactivity",
        id: "interactivity",
        current: selectedTab === "interactivity",
      },
      {
        name: "Style",
        id: "style",
        current: selectedTab === "style",
      },
    ];
  }, [selectedTab]);

  const [referenceCopied, setReferenceCopied] = useState(false);

  const copyReference = useCallback(() => {
    if (item) {
      copyTextToClipboard(item.stableId);
      setReferenceCopied(true);
      setTimeout(() => {
        setReferenceCopied(false);
      }, 2000);
    }
  }, [setReferenceCopied, item]);
  return (
    <div
      className="bg-white z-20 absolute bottom-0 w-128 flex flex-col"
      style={{ height: "calc(100vh)" }}
    >
      <div className="flex-0 p-4 shadow-sm bg-gray-700 text-primary-300 flex items-center">
        <h4 className="font-medium text-indigo-100 flex-1">{item?.title}</h4>
        <button
          className="bg-gray-300 bg-opacity-25 float-right rounded-full p-1 cursor-pointer focus:ring-blue-300"
          onClick={props.onRequestClose}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            className="w-5 h-5 text-white"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      <div className="flex-0 p-2 px-4 -mt-4 shadow-sm bg-gray-700 text-primary-300 flex items-center">
        <Tabs dark small tabs={tabs} onClick={(id) => setSelectedTab(id)} />
      </div>
      {!item && <Spinner />}
      {item && selectedTab === "settings" && (
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="md:max-w-sm mt-5 relative">
            <MutableAutosaveInput
              // autofocus
              mutation={mutateItem}
              mutationStatus={mutateItemState}
              propName="title"
              value={item?.title || ""}
              label={t("Title")}
              variables={{ id: props.itemId }}
            />
            <TranslatedPropControl
              id={item.id}
              label={t("Overlay Title")}
              propName="title"
              typeName="TableOfContentsItem"
              defaultValue={item.title}
              className="p-0.5 absolute -right-9 top-8 -mt-0.5 border rounded hover:shadow-sm"
            />
          </div>
          <div className="md:max-w-sm mt-5 relative">
            <MutableAutosaveInput
              propName="attribution"
              mutation={mutateSource}
              mutationStatus={mutateSourceState}
              value={source?.attribution || ""}
              label={t("Attribution")}
              description={t(
                "If set, a short attribution string will be shown at the bottom of the map."
              )}
              variables={{ id: source?.id }}
            />
            {/* TODO: Disabled for now because working it into MapContextManager is tricky */}
            {/* {source && (
              <TranslatedPropControl
                id={source.id}
                label={t("Overlay Attribution")}
                propName="attribution"
                typeName="DataSource"
                defaultValue={source.attribution}
                className="p-0.5 absolute -right-9 top-8 -mt-0.5 border rounded hover:shadow-sm"
              />
            )} */}
          </div>
          <div className="md:max-w-sm mt-5">
            <MutableAutosaveInput
              propName="geoprocessingReferenceId"
              mutation={mutateItem}
              mutationStatus={mutateItemState}
              value={item.geoprocessingReferenceId || ""}
              label={t("Geoprocessing Reference ID")}
              description={
                <span>
                  {t(
                    "Overlays can be assigned a stable id for reference by geoprocessing clients. You can also refer to this overlay using the following ID."
                  )}
                  <Tooltip>
                    <TooltipTrigger>
                      <button
                        onClick={copyReference}
                        className="mx-1 px-1 bg-blue-50 border-blue-300 rounded border font-mono select-text"
                      >
                        {item.stableId}
                        <ClipboardCopyIcon className="w-4 h-4 ml-1 inline -mt-0.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {referenceCopied ? (
                        <Trans ns="homepage">Copied!</Trans>
                      ) : (
                        <Trans ns="homepage">Copy Reference</Trans>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </span>
              }
              variables={{ id: item.id }}
            />
          </div>
          <div className="mt-5">
            {item.acl?.nodeId && (
              <AccessControlListEditor nodeId={item.acl?.nodeId} />
            )}
          </div>
          {(source?.type === DataSourceTypes.Geojson ||
            source?.type === DataSourceTypes.SeasketchVector ||
            source?.type === DataSourceTypes.SeasketchMvt) && (
            <div className="mt-5">
              <div className="flex">
                <div className="flex-1 text-sm font-medium text-gray-700">
                  <Trans ns={["admin"]}>Enable data download</Trans>
                </div>
                <div className="flex-none">
                  <Switch
                    isToggled={
                      downloadEnabled === undefined
                        ? item.enableDownload
                        : downloadEnabled
                    }
                    onClick={() =>
                      setDownloadEnabled(
                        !(downloadEnabled === undefined
                          ? item.enableDownload
                          : downloadEnabled)
                      )
                    }
                  />
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                <Trans ns={["admin"]}>
                  If enabled, users will be able to download this dataset in
                  GeoJSON vector format using the context menu.
                </Trans>
              </p>
            </div>
          )}

          <div className="mt-5">
            <div className="border rounded">
              <div className="border-gray-200 border-b">
                {(source?.type === DataSourceTypes.SeasketchVector ||
                  source?.type === DataSourceTypes.SeasketchMvt) && (
                  <>
                    <dl className="sm:divide-y sm:divide-gray-200 zebra-stripe-child-div">
                      <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 px-2">
                        <dt className="text-sm font-medium text-gray-500">
                          <Trans ns={["admin"]}>Source Type</Trans>
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                          {source?.type === DataSourceTypes.SeasketchVector && (
                            <Trans ns={["admin"]}>
                              GeoJSON data hosted on SeaSketch
                            </Trans>
                          )}
                          {source?.type === DataSourceTypes.SeasketchMvt && (
                            <Trans ns={["admin"]}>
                              Vector tiles hosted on SeaSketch
                            </Trans>
                          )}
                        </dd>
                      </div>
                      {source.geostats && source.geostats.geometry && (
                        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 px-2">
                          <dt className="text-sm font-medium text-gray-500">
                            <Trans ns={["admin"]}>Geometry Type</Trans>
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                            {source.geostats.geometry}
                          </dd>
                        </div>
                      )}
                      {source.geostats && source.geostats.count && (
                        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 px-2">
                          <dt className="text-sm font-medium text-gray-500">
                            <Trans ns={["admin"]}>Feature Count</Trans>
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                            {source.geostats.count}
                          </dd>
                        </div>
                      )}
                      <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 px-2">
                        <dt className="text-sm font-medium text-gray-500">
                          <Trans ns={["admin"]}>File Size</Trans>
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                          {bytes.format(source?.byteLength || 0)}
                        </dd>
                      </div>
                      {source.uploadedSourceFilename && (
                        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 px-2">
                          <dt className="text-sm font-medium text-gray-500">
                            <Trans ns={["admin"]}>Uploaded by</Trans>
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                            {source.uploadedBy || "Unknown"}
                            {source.createdAt &&
                              " on " +
                                new Date(source.createdAt).toLocaleDateString()}
                          </dd>
                        </div>
                      )}
                      <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 px-2">
                        <dt className="text-sm font-medium text-gray-500">
                          <Trans ns={["admin"]}>Original Source</Trans>
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 truncate">
                          {source?.originalSourceUrl && (
                            <a
                              target="_blank"
                              className="text-primary-600 underline"
                              href={source?.originalSourceUrl}
                              rel="noreferrer"
                            >
                              {source?.originalSourceUrl
                                .replace("https://", "")
                                .replace("http://", "")}
                            </a>
                          )}
                          {source?.importType ===
                            DataSourceImportTypes.Upload &&
                            (source.uploadedSourceFilename || "User Upload")}
                        </dd>
                      </div>
                      {source.geostats &&
                        source.geostats.attributes &&
                        Array.isArray(source.geostats.attributes) && (
                          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 px-2">
                            <h4 className="text-sm font-medium text-gray-500">
                              <Trans ns={["admin"]}>Columns</Trans>
                            </h4>
                            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                              {(
                                source.geostats.attributes as {
                                  type: string;
                                  count: number;
                                  attribute: string;
                                  values: any[];
                                  max?: number;
                                  min?: number;
                                }[]
                              )
                                .slice(
                                  0,
                                  showMoreColumns
                                    ? source.geostats.attributes.length
                                    : 4
                                )
                                .map((attr) => {
                                  return (
                                    <div className="flex">
                                      <div className="flex-1 italic">
                                        {attr.attribute}{" "}
                                        {attr.values.length && (
                                          <div
                                            className="inline-block cursor-help"
                                            title={attr.values.join("\n")}
                                          >
                                            <DotsHorizontalIcon className="w-4 h-4 inline-block text-gray-500" />
                                          </div>
                                        )}
                                      </div>
                                      <div className="font-mono px-2">
                                        {attr.type}
                                      </div>
                                    </div>
                                  );
                                })}
                              {showMoreColumns === false &&
                                source.geostats.attributes.length > 4 && (
                                  <button
                                    className="underline py-1 text-primary-500"
                                    onClick={() => setShowMoreColums(true)}
                                  >
                                    <Trans ns="admin:data">
                                      Show{" "}
                                      {(
                                        source.geostats.attributes.length - 4
                                      ).toString()}{" "}
                                      more
                                    </Trans>
                                  </button>
                                )}
                            </dd>
                          </div>
                        )}{" "}
                    </dl>
                  </>
                )}
                {source?.type === DataSourceTypes.ArcgisVector && (
                  <>
                    <dl className="sm:divide-y sm:divide-gray-200">
                      <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
                        <dt className="text-sm font-medium text-gray-500">
                          <Trans ns={["admin"]}>Source Type</Trans>
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                          <Trans ns={["admin"]}>
                            Vector data hosted on ArcGIS Server
                          </Trans>
                        </dd>
                      </div>
                      <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
                        <dt className="text-sm font-medium text-gray-500">
                          <Trans ns={["admin"]}>Source Server</Trans>
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 truncate">
                          <a
                            target="_blank"
                            className="text-primary-600 underline"
                            href={source.url!}
                            rel="noreferrer"
                          >
                            {source
                              .url!.replace("https://", "")
                              .replace("http://", "")}
                          </a>
                        </dd>
                      </div>
                    </dl>
                  </>
                )}
                {source?.type === DataSourceTypes.ArcgisDynamicMapserver && (
                  <>
                    <dl className="sm:divide-y sm:divide-gray-200">
                      <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
                        <dt className="text-sm font-medium text-gray-500">
                          <Trans ns={["admin"]}>Source Type</Trans>
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                          <Trans ns={["admin"]}>
                            ArcGIS Dynamic Map Service
                          </Trans>
                        </dd>
                      </div>
                      <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
                        <dt className="text-sm font-medium text-gray-500">
                          <Trans ns={["admin"]}>Source Server</Trans>
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 truncate">
                          <a
                            target="_blank"
                            className="text-primary-600 underline"
                            href={source.url!}
                            rel="noreferrer"
                          >
                            {source
                              .url!.replace("https://", "")
                              .replace("http://", "")}
                          </a>
                        </dd>
                      </div>
                      <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
                        <dt className="text-sm font-medium text-gray-500">
                          <Trans ns={["admin"]}>Dynamic Layers</Trans>
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                          {source.supportsDynamicLayers ? (
                            <Trans ns={["admin"]}>
                              Supported. Users can control layer visibility,
                              opacity, and ordering.
                            </Trans>
                          ) : (
                            <Trans ns={["admin"]}>
                              <b>Unsupported</b>. Users will not be able to
                              control the visibility and ordering of individual
                              layers.
                            </Trans>
                          )}
                        </dd>
                      </div>
                    </dl>
                  </>
                )}
              </div>
              {source?.type === DataSourceTypes.ArcgisVector && (
                <InputBlock
                  className="mt-4 text-sm"
                  title={t("Geometry Precision")}
                  input={
                    <select
                      id="geometryPrecision"
                      // className="form-select rounded block w-full pl-3 pr-8 text-base leading-6 border-gray-300 focus:outline-none focus:shadow-outline-blue focus:border-blue-300 sm:text-sm sm:leading-5"
                      className="inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 focus:ring-indigo-500 pr-8"
                      value={source.queryParameters.geometryPrecision}
                      disabled={updateQueryParametersState.loading}
                      onChange={(e) => {
                        const queryParameters = {
                          ...source.queryParameters,
                          geometryPrecision: e.target.value,
                        };
                        client.writeFragment({
                          id: `DataSource:${source.id}`,
                          fragment: gql`
                            fragment NewQueryParameters on DataSource {
                              queryParameters
                            }
                          `,
                          data: {
                            queryParameters,
                          },
                        });
                        updateQueryParameters({
                          variables: {
                            sourceId: source.id,
                            queryParameters,
                          },
                        });
                      }}
                    >
                      <option value="5">1 m</option>
                      <option value="6">10 cm</option>
                    </select>
                  }
                >
                  {t("Using a lower level of precision reduces download size")}
                </InputBlock>
              )}
              {source?.type === DataSourceTypes.ArcgisDynamicMapserver && (
                <>
                  <InputBlock
                    title={t("Enable High-DPI Requests")}
                    className="mt-4 text-sm"
                    input={
                      <Switch
                        isToggled={!!source.useDevicePixelRatio}
                        onClick={(value) => {
                          client.writeFragment({
                            id: `DataSource:${source.id}`,
                            fragment: gql`
                              fragment UpdateHighDPI on DataSource {
                                useDevicePixelRatio
                              }
                            `,
                            data: {
                              useDevicePixelRatio: value,
                            },
                          });
                          updateEnableHighDpiRequests({
                            variables: {
                              sourceId: source.id,
                              useDevicePixelRatio: value,
                            },
                          });
                        }}
                      />
                    }
                  >
                    <Trans ns="admin">
                      Request higher resolution images when the user has a
                      "Retina" or 4k display. Maps will be much more detailed,
                      but it demands more of the data server.
                    </Trans>
                  </InputBlock>
                  <InputBlock
                    className="mt-4 text-sm"
                    title={t("Image Format")}
                    input={
                      <select
                        id="imageFormat"
                        className="rounded form-select block w-full pl-3 pr-4 text-base leading-6 border-gray-300 focus:outline-none focus:shadow-outline-blue focus:border-blue-300 sm:text-sm sm:leading-5"
                        value={source.queryParameters?.format || "PNG"}
                        onChange={(e) => {
                          client.writeFragment({
                            id: `DataSource:${source.id}`,
                            fragment: gql`
                              fragment UpdateFormat on DataSource {
                                queryParameters
                              }
                            `,
                            data: {
                              queryParameters: {
                                ...source.queryParameters,
                                format: e.target.value,
                              },
                            },
                          });
                          updateQueryParameters({
                            variables: {
                              sourceId: source.id,
                              queryParameters: {
                                ...source.queryParameters,
                                format: e.target.value,
                              },
                            },
                          });
                        }}
                      >
                        {["PNG", "PNG8", "PNG24", "PNG32", "GIF", "JPG"].map(
                          (f) => (
                            <option key={f} value={f}>
                              {f.toLocaleLowerCase()}
                            </option>
                          )
                        )}
                      </select>
                    }
                  >
                    <Trans ns="admin">
                      Imagery data looks best using <code>jpg</code>, for others{" "}
                      <code>png</code> is a good choice.
                    </Trans>
                  </InputBlock>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {item && selectedTab === "interactivity" && (
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="mt-5">
            {source && layer && (
              <InteractivitySettings
                id={layer.interactivitySettingsId}
                dataSourceId={layer.dataSourceId}
                sublayer={layer.sublayer}
              />
            )}
          </div>
          <div className="mt-5">
            <MutableRadioGroup
              value={layer?.renderUnder}
              legend={t(`Basemap Integration`)}
              mutate={mutateLayer}
              mutationStatus={mutateLayerState}
              propName={"renderUnder"}
              variables={{ id: layer?.id }}
              items={[
                {
                  value: RenderUnderType.Labels,
                  label: t("Show Under Labels"),
                  description: t(
                    "Display this layer under any text labels on the basemap."
                  ),
                },
                // {
                //   value: RenderUnderType.Land,
                //   label: t("Show Under Land"),
                //   description: t(
                //     "Useful when you want to present data that may not have a matching shoreline."
                //   ),
                // },
                {
                  value: RenderUnderType.None,
                  label: t("Cover Basemap"),
                  description: t(
                    "Render this layer above the basemap entirely."
                  ),
                },
              ]}
            />
          </div>
        </div>
      )}

      {item && selectedTab === "style" && (
        <div className="h-full overflow-hidden">
          {source &&
            (source.type === DataSourceTypes.Geojson ||
              source.type === DataSourceTypes.SeasketchVector ||
              source.type === DataSourceTypes.SeasketchMvt ||
              source.type === DataSourceTypes.SeasketchRaster ||
              source.type === DataSourceTypes.Vector) && (
              <div className="h-full overflow-hidden flex flex-col">
                <p className="text-sm text-gray-100 px-2 pb-2 pt-1 bg-gray-700">
                  <Trans ns={["admin"]}>
                    Vector layers can be styled using{" "}
                    <a
                      className="underline text-primary-300"
                      href="https://docs.mapbox.com/mapbox-gl-js/style-spec/layers/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      MapBox GL Style Layers
                    </a>
                    . Don't specify a <code>source</code> or <code>id</code>{" "}
                    property on your layers, those will be managed for you by
                    SeaSketch. Press{" "}
                    <span className="font-mono">Control+Space</span> to
                    autocomplete string values and property names, and hover
                    over properties to see documentation.
                  </Trans>
                </p>
                {updateGLStyleMutationState.error && (
                  <p className="bg-gray-700 text-red-200 p-2 text-sm">
                    <Trans ns="admin:data">Style save error - </Trans>
                    {updateGLStyleMutationState.error.message}
                  </p>
                )}
                <GLStyleEditor
                  tocItemId={item.stableId}
                  geostats={source.geostats}
                  type={
                    source.type === DataSourceTypes.SeasketchRaster
                      ? "raster"
                      : "vector"
                  }
                  className="flex-1 overflow-hidden"
                  initialStyle={
                    typeof layer!.mapboxGlStyles! === "string"
                      ? layer!.mapboxGlStyles
                      : JSON.stringify(layer!.mapboxGlStyles!, null, "  ")
                  }
                  onChange={(newStyle) => {
                    client.writeFragment({
                      id: `DataLayer:${layer!.id}`,
                      fragment: gql`
                        fragment NewGLStyle on DataLayer {
                          mapboxGlStyles
                        }
                      `,
                      data: {
                        mapboxGlStyles: JSON.parse(newStyle),
                      },
                    });
                    setStyle(newStyle);
                  }}
                  bounds={
                    item.bounds
                      ? (item.bounds.map((b) => parseFloat(b)) as [
                          number,
                          number,
                          number,
                          number
                        ])
                      : undefined
                  }
                />
              </div>
            )}
        </div>
      )}
    </div>
  );
}
