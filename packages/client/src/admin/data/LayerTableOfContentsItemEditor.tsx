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
  ArcgisFeatureLayerFetchStrategy,
  useUpdateFetchStrategyMutation,
  SublayerType,
} from "../../generated/graphql";
import { useTranslation, Trans } from "react-i18next";
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
import { ClipboardCopyIcon } from "@heroicons/react/outline";
import Tabs, { NonLinkTabItem } from "../../components/Tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../components/Tooltip";
import { copyTextToClipboard } from "../../projects/Forums/InlineAuthorDetails";
import { MapContext } from "../../dataLayers/MapContextManager";
import TranslatedPropControl from "../../components/TranslatedPropControl";
import {
  SettingsDLListItem,
  SettingsDefinitionList,
} from "../SettingsDefinitionList";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import FeatureLayerPerformanceDetailsModal from "./FeatureLayerPerformanceDetailsModal";
import { ChartBarIcon } from "@heroicons/react/solid";
import ArcGISTiledRasterSettings from "./ArcGISTiledRasterSettings";
import { CaretRightIcon, ExclamationTriangleIcon } from "@radix-ui/react-icons";
import ConvertFeatureLayerToHostedBlock from "./ConvertFeatureLayerToHostedBlock";
import Skeleton from "../../components/Skeleton";
import FolderIcon from "../../components/FolderIcon";
import OverlayMetataEditor from "./OverlayMetadataEditor";
import useDialog from "../../components/useDialog";

interface LayerTableOfContentsItemEditorProps {
  itemId: number;
  onRequestClose?: () => void;
  title: string;
}

export default function LayerTableOfContentsItemEditor(
  props: LayerTableOfContentsItemEditorProps
) {
  const { t } = useTranslation("admin");
  const { confirm } = useDialog();
  const [preventUnloadMessages, setPreventUnloadMessages] = useState<{
    [component: string]: string;
  }>({});

  const onRequestClose = useCallback(async () => {
    for (const message of Object.values(preventUnloadMessages)) {
      if (!(await confirm(message))) {
        return;
      }
    }
    if (props.onRequestClose) {
      props.onRequestClose();
    }
  }, [props, preventUnloadMessages, confirm]);

  useEffect(() => {
    const firstMessage = Object.values(preventUnloadMessages)[0];
    if (firstMessage) {
      const handler = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = firstMessage;
      };
      window.addEventListener("beforeunload", handler);
      return () => {
        window.removeEventListener("beforeunload", handler);
      };
    }
  }, [preventUnloadMessages]);

  const registerPreventUnload = useCallback(
    (componentId: string, message?: string) => {
      setPreventUnloadMessages((prev) => {
        if (message) {
          return { ...prev, [componentId]: message };
        } else {
          const n = { ...prev };
          delete n[componentId];
          return n;
        }
      });
    },
    [setPreventUnloadMessages]
  );

  const { data, loading, error } = useGetLayerItemQuery({
    variables: {
      id: props.itemId,
    },
    fetchPolicy: "cache-and-network",
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
  const onError = useGlobalErrorHandler();
  const [mutateSource, mutateSourceState] = useUpdateDataSourceMutation({
    onError,
    // @ts-ignore
    optimisticResponse: (data) => {
      return {
        __typename: "Mutation",
        updateDataSource: {
          __typename: "UpdateDataSourcePayload",
          dataSource: {
            __typename: "DataSource",
            attribution: data.attribution,
            ...data,
          },
        },
      };
    },
  });
  const [updateQueryParameters] = useUpdateQueryParametersMutation();
  const [mutateLayer, mutateLayerState] = useUpdateLayerMutation();
  const [updateGLStyleMutation, updateGLStyleMutationState] =
    useUpdateLayerMutation();
  const [updateEnableDownload, updateEnableDownloadState] =
    useUpdateEnableDownloadMutation();
  const [updateEnableHighDpiRequests] = useUpdateEnableHighDpiRequestsMutation({
    onError,
    optimisticResponse: (data) => {
      return {
        __typename: "Mutation",
        updateDataSource: {
          __typename: "UpdateDataSourcePayload",
          dataSource: {
            __typename: "DataSource",
            id: data.sourceId,
            useDevicePixelRatio: data.useDevicePixelRatio,
          },
        },
      };
    },
  });
  const [updateFetchStrategy] = useUpdateFetchStrategyMutation({
    onError,
    optimisticResponse: (data) => {
      return {
        __typename: "Mutation",
        updateDataSource: {
          __typename: "UpdateDataSourcePayload",
          dataSource: {
            __typename: "DataSource",
            id: data.sourceId,
            arcgisFetchStrategy: data.fetchStrategy,
          },
        },
      };
    },
  });

  const item = data?.tableOfContentsItem;
  const [downloadEnabled, setDownloadEnabled] = useState<boolean>();

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
        name: "Metadata",
        id: "metadata",
        current: selectedTab === "metadata",
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

  const isArcGISCustomSource =
    source?.type === DataSourceTypes.ArcgisDynamicMapserver ||
    source?.type === DataSourceTypes.ArcgisRasterTiles ||
    source?.type === DataSourceTypes.ArcgisVector;

  const [perfModalOpen, setPerfModalOpen] = useState<string | false>(false);

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
      className="bg-white z-30 absolute bottom-0 w-128 flex flex-col"
      style={{ height: "calc(100vh)" }}
    >
      <div className="flex-0 px-4 pt-4 pb-1 shadow-sm bg-gray-700 text-primary-300 flex items-center">
        <h4 className="font-medium text-indigo-100 flex-1 truncate">
          {error ? t("Error") : item?.title || props.title || t("Loading")}
        </h4>
        <button
          className="bg-gray-300 bg-opacity-25 float-right rounded-full p-1 cursor-pointer focus:ring-blue-300"
          onClick={onRequestClose}
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
      {item?.containedBy && item.containedBy.length > 0 && (
        <div
          style={
            {
              // backgroundColor: "rgb(60 79 145)",
            }
          }
          className="px-4 py-1 bg-gray-700 text-gray-300 text-sm"
        >
          {item.containedBy.map((parent) => (
            <span className="inline-flex items-center" key={parent!.id}>
              <CaretRightIcon />
              <FolderIcon />
              <span className="pl-1">{parent?.title}</span>
            </span>
          ))}
        </div>
      )}
      <div className="flex-0 p-2 px-4 shadow-sm bg-gray-700 text-primary-300 flex items-center">
        <Tabs dark small tabs={tabs} onClick={(id) => setSelectedTab(id)} />
      </div>
      {error && (
        <div className="p-4 py-6 space-y-2 text-red-800">
          <p>{t("Failed to load overlay settings.")}</p>
          <p>{error.message}</p>
        </div>
      )}
      {!item && !error && (
        <div className="p-4 py-6 space-y-6">
          <div className="space-y-2">
            <Skeleton className="w-1/4 h-4" />
            <Skeleton className="w-full h-4" />
          </div>
          <div className="space-y-2">
            <Skeleton className="w-1/4 h-4" />
            <Skeleton className="w-full h-4" />
            <Skeleton className="w-full h-4" />
            <Skeleton className="w-full h-4" />
            <Skeleton className="w-full h-4" />
          </div>
          <div className="space-y-2">
            <Skeleton className="w-1/4 h-4" />
            <Skeleton className="w-full h-12 rounded" />
            <Skeleton className="w-full h-12 rounded" />
            <Skeleton className="w-full h-12 rounded" />
          </div>
          <div className="space-y-2">
            <Skeleton className="w-1/4 h-4" />
            <Skeleton className="w-full h-4" />
            <Skeleton className="w-full h-4" />
            <Skeleton className="w-full h-4" />
            <Skeleton className="w-full h-4" />
          </div>
        </div>
      )}
      {item && (
        <div className={selectedTab !== "metadata" ? "hidden" : ""}>
          <OverlayMetataEditor
            id={item.id}
            registerPreventUnload={registerPreventUnload}
          />
        </div>
      )}
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
              onChange={async (value) => {
                const sourceObj = source?.id
                  ? mapContext.manager?.map?.getSource(source.id.toString())
                  : undefined;
                if (!sourceObj) {
                  return;
                }
                // Danger Danger! Private method used here!
                // https://gis.stackexchange.com/questions/407876/how-to-update-source-property-attribution-in-mapbox-gl
                // @ts-ignore
                const controls = mapContext.manager?.map?._controls;
                let updateAttribution: undefined | Function;
                if (controls && Array.isArray(controls)) {
                  for (const control of controls) {
                    if (
                      "_updateAttributions" in control &&
                      typeof control._updateAttributions === "function"
                    ) {
                      updateAttribution = (attr: string) => {
                        // @ts-ignore
                        sourceObj.attribution = attr;
                        // @ts-ignore
                        control._updateAttributions();
                      };
                    }
                  }
                }
                if (updateAttribution) {
                  if (value?.trim().length === 0 && source?.id) {
                    const customSource = mapContext.manager?.getCustomGLSource(
                      source?.id
                    );
                    if (!customSource) {
                      updateAttribution("");
                    } else {
                      const metadata = await customSource.getComputedMetadata();
                      updateAttribution(metadata.attribution || " ");
                    }
                  } else {
                    updateAttribution(value);
                  }
                }
              }}
              description={
                isArcGISCustomSource
                  ? t(
                      "Leave blank to display attribution dynamically from ArcGIS service, or provide attribution to override the service metadata."
                    )
                  : t(
                      "If set, a short attribution string will be shown at the bottom of the map."
                    )
              }
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

          {(source?.type === DataSourceTypes.ArcgisVector ||
            (source?.type === DataSourceTypes.ArcgisDynamicMapserver &&
              layer?.sublayerType === SublayerType.Vector)) && (
            <div className="mt-5">
              <div className="flex">
                <div className={`flex-1 text-sm font-medium text-gray-700`}>
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
                  If enabled, users will have the ability to download raw
                  feature data as a GeoJSON file. SeaSketch will extract vector
                  features from the service using the{" "}
                  <a
                    className="text-primary-500"
                    href="https://developers.arcgis.com/rest/services-reference/enterprise/query-feature-service-layer-.htm"
                    target="_blank"
                  >
                    ArcGIS REST API query endpoint
                  </a>
                  . Cached data may be up to 3 hours old. As an admin, you can
                  always{" "}
                  <a
                    target="_blank"
                    className="text-primary-500"
                    href={item.primaryDownloadUrl!}
                  >
                    click here to download
                  </a>
                  .
                </Trans>
              </p>
            </div>
          )}

          {(source?.type === DataSourceTypes.Geojson ||
            source?.type === DataSourceTypes.SeasketchVector ||
            source?.type === DataSourceTypes.SeasketchMvt) && (
            <div className="mt-5">
              <div className="flex">
                <div className={`flex-1 text-sm font-medium text-gray-700`}>
                  <Trans ns={["admin"]}>Enable data download</Trans>
                </div>
                <div className="flex-none">
                  <Switch
                    disabled={
                      !Boolean(
                        data.tableOfContentsItem?.hasOriginalSourceUpload
                      )
                    }
                    isToggled={
                      Boolean(
                        data.tableOfContentsItem?.hasOriginalSourceUpload
                      ) &&
                      (downloadEnabled === undefined
                        ? item.enableDownload
                        : downloadEnabled)
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
              {Boolean(data.tableOfContentsItem?.hasOriginalSourceUpload) ? (
                <p className="text-sm text-gray-500 mt-1">
                  <Trans ns={["admin"]}>
                    If enabled, users will be able to download the original data
                    file uploaded to SeaSketch.
                  </Trans>
                </p>
              ) : (
                <div className="flex border p-2 mt-1 items-center space-x-4 rounded">
                  <ExclamationTriangleIcon className="h-24 w-24 px-2 text-gray-500" />
                  <p className="text-sm text-gray-500">
                    <Trans ns={["admin"]}>
                      Data download cannot be enabled because the original is
                      not available. SeaSketch only recently began storing
                      original uploaded files, so older data layers may need to
                      be uploaded again to support this capability.
                    </Trans>
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="mt-5">
            <div className="border rounded">
              <div className="border-gray-200 border-b">
                {(source?.type === DataSourceTypes.SeasketchVector ||
                  source?.type === DataSourceTypes.SeasketchMvt) && (
                  <>
                    <SettingsDefinitionList>
                      <SettingsDLListItem
                        term={t("Source Type")}
                        description={
                          <>
                            {source?.type ===
                              DataSourceTypes.SeasketchVector && (
                              <Trans ns={["admin"]}>
                                GeoJSON data hosted on SeaSketch
                              </Trans>
                            )}
                            {source?.type === DataSourceTypes.SeasketchMvt && (
                              <Trans ns={["admin"]}>
                                Vector tiles hosted on SeaSketch
                              </Trans>
                            )}
                          </>
                        }
                      />
                      {source.geostats && source.geostats.geometry && (
                        <SettingsDLListItem
                          term={t("Geometry Type")}
                          description={source.geostats.geometry}
                        />
                      )}
                      {source.geostats && source.geostats.count && (
                        <SettingsDLListItem
                          term={t("Feature Count")}
                          description={source.geostats.count}
                        />
                      )}
                      <SettingsDLListItem
                        term={t("File Size")}
                        description={bytes.format(source?.byteLength || 0)}
                      />
                      {source.uploadedSourceFilename && (
                        <SettingsDLListItem
                          term={t("Uploaded by")}
                          description={
                            <>
                              {source.uploadedBy || "Unknown"}
                              {source.createdAt &&
                                " on " +
                                  new Date(
                                    source.createdAt
                                  ).toLocaleDateString()}
                            </>
                          }
                        />
                      )}
                      <SettingsDLListItem
                        truncate
                        term={t("Original Source")}
                        description={
                          <>
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
                              DataSourceImportTypes.Upload && (
                              <UploadedSourceName
                                filename={source.uploadedSourceFilename!}
                                primaryDownloadUrl={
                                  data.tableOfContentsItem?.primaryDownloadUrl!
                                }
                              />
                            )}
                          </>
                        }
                      />
                    </SettingsDefinitionList>
                  </>
                )}
                {source?.type === DataSourceTypes.ArcgisVector && (
                  <>
                    <SettingsDefinitionList>
                      <SettingsDLListItem
                        term={t("Source Type")}
                        description={t("ArcGIS Vector Feature Layer")}
                      />
                      <SettingsDLListItem
                        truncate
                        term={t("Source Server")}
                        description={
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
                        }
                      />
                      <InputBlock
                        className="py-4 text-sm font-medium text-gray-500"
                        title={t("Fetch Strategy")}
                        input={
                          <select
                            id="imageFormat"
                            className="rounded form-select block w-full pl-3 pr-7 text-base leading-6 border-gray-300 focus:outline-none focus:shadow-outline-blue focus:border-blue-300 sm:text-sm sm:leading-5"
                            value={
                              source.arcgisFetchStrategy ||
                              ArcgisFeatureLayerFetchStrategy.Auto
                            }
                            onChange={(e) => {
                              updateFetchStrategy({
                                variables: {
                                  sourceId: source.id,
                                  fetchStrategy: e.target
                                    .value as ArcgisFeatureLayerFetchStrategy,
                                },
                              });
                            }}
                          >
                            <option
                              value={ArcgisFeatureLayerFetchStrategy.Auto}
                            >
                              Auto
                            </option>
                            <option value={ArcgisFeatureLayerFetchStrategy.Raw}>
                              GeoJSON
                            </option>
                            <option
                              value={ArcgisFeatureLayerFetchStrategy.Tiled}
                            >
                              Tiled
                            </option>
                          </select>
                        }
                      >
                        <Trans ns="admin">
                          SeaSketch determines an appropriate strategy for
                          retrieving vector data at import time. <br />
                          <em>GeoJSON</em> requests offer best performance when
                          datasets can be downloaded in a single request.{" "}
                          <em>Tiled</em> requests can be used for datasets that
                          are too large or contain &gt; 2000 features.{" "}
                          <em>Auto</em> is not recommended other than for
                          debugging.
                          <br />
                          <button
                            className="underline text-primary-500 mt-1"
                            onClick={() => setPerfModalOpen(source!.url!)}
                          >
                            <ChartBarIcon className=" w-4 h-4 inline mr-1" />
                            {t("Analyze layer performance details")}
                          </button>
                        </Trans>
                      </InputBlock>
                      <div className="py-4 text-sm text-gray-500">
                        <ConvertFeatureLayerToHostedBlock item={item} />
                      </div>
                    </SettingsDefinitionList>
                    {perfModalOpen && (
                      <FeatureLayerPerformanceDetailsModal
                        url={source.url!}
                        sourceName={item.title}
                        onRequestClose={() => setPerfModalOpen(false)}
                      />
                    )}
                  </>
                )}
                {source?.type === DataSourceTypes.ArcgisDynamicMapserver && (
                  <SettingsDefinitionList>
                    <SettingsDLListItem
                      term={t("Source Type")}
                      description={t("ArcGIS Dynamic Map Service")}
                    />
                    <SettingsDLListItem
                      truncate
                      term={t("Source Server")}
                      description={
                        <a
                          target="_blank"
                          className="text-primary-600 underline"
                          href={source.url! + "/" + layer?.sublayer}
                          rel="noreferrer"
                        >
                          {source
                            .url!.replace("https://", "")
                            .replace("http://", "") + layer?.sublayer}
                        </a>
                      }
                    />
                    {/* <SettingsDLListItem
                      term={t("Dynamic Layers")}
                      description={
                        source.supportsDynamicLayers ? (
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
                        )
                      }
                    /> */}
                    <InputBlock
                      title={t("Enable High-DPI Requests")}
                      className="py-4 text-sm font-medium text-gray-500"
                      input={
                        <Switch
                          isToggled={!!source.useDevicePixelRatio}
                          onClick={(value) => {
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
                      className="py-4 text-sm font-medium text-gray-500"
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
                        Imagery data looks best using <code>jpg</code>, for all
                        others <code>png</code> is usually the right choice.
                      </Trans>
                    </InputBlock>
                    {layer?.sublayerType === SublayerType.Vector && (
                      <div className="py-4 text-sm text-gray-500">
                        <ConvertFeatureLayerToHostedBlock item={item} />
                      </div>
                    )}
                  </SettingsDefinitionList>
                )}
                {source?.type === DataSourceTypes.ArcgisRasterTiles && (
                  <ArcGISTiledRasterSettings source={source} />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {item && selectedTab === "interactivity" && (
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="mt-5">
            {source &&
              layer &&
              source.type !== DataSourceTypes.ArcgisRasterTiles && (
                <InteractivitySettings
                  id={layer.interactivitySettingsId}
                  dataSourceId={layer.dataSourceId}
                  sublayer={layer.sublayer}
                  geostats={source.geostats}
                />
              )}
            {source &&
              layer &&
              source.type === DataSourceTypes.ArcgisRasterTiles && (
                <div className="bg-gray-50 text-sm border p-4 rounded flex items-center space-x-4">
                  <ExclamationTriangleIcon className="h-8 w-8 text-gray-600" />
                  <div>
                    <Trans ns="admin:data">
                      Popups and other interactivity options are not supported
                      for tiled ArcGIS sources.
                    </Trans>
                  </div>
                </div>
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
                    mapContext.manager?.updateLegends(true);
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
          {isArcGISCustomSource && (
            <div className="bg-gray-50 text-sm border p-4 rounded flex items-center space-x-4 m-4 mt-5">
              <ExclamationTriangleIcon className="h-8 w-8 text-gray-600" />
              <div className="flex-1">
                <Trans ns="admin:data">
                  Styling is not available for ArcGIS sources. SeaSketch
                  respects cartographic styling as it is defined in the service
                  and will change automatically when the service is updated.
                </Trans>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UploadedSourceName({
  filename,
  primaryDownloadUrl,
}: {
  filename?: string;
  primaryDownloadUrl?: string;
}) {
  if (primaryDownloadUrl) {
    return (
      <a
        className="text-primary-500 underline"
        download={filename}
        href={primaryDownloadUrl}
      >
        {filename}
      </a>
    );
  } else {
    return <span>{filename || "User upload"}</span>;
  }
}
