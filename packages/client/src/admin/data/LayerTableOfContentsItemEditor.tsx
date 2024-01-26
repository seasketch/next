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
import {
  SettingsDLListItem,
  SettingsDefinitionList,
} from "../SettingsDefinitionList";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import FeatureLayerPerformanceDetailsModal from "./FeatureLayerPerformanceDetailsModal";
import { ChartBarIcon } from "@heroicons/react/solid";
import ArcGISTiledRasterSettings from "./ArcGISTiledRasterSettings";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";

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
      className="bg-white z-20 absolute bottom-0 w-128 flex flex-col"
      style={{ height: "calc(100vh)" }}
    >
      <div className="flex-0 p-4 shadow-sm bg-gray-700 text-primary-300 flex items-center">
        <h4 className="font-medium text-indigo-100 flex-1 truncate">
          {item?.title}
        </h4>
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
                              DataSourceImportTypes.Upload &&
                              (source.uploadedSourceFilename || "User Upload")}
                          </>
                        }
                      />
                      {source.geostats &&
                        source.geostats.attributes &&
                        Array.isArray(source.geostats.attributes) && (
                          <SettingsDLListItem
                            term={t("Columns")}
                            description={
                              <>
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
                              </>
                            }
                          />
                        )}
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
                          href={source.url!}
                          rel="noreferrer"
                        >
                          {source
                            .url!.replace("https://", "")
                            .replace("http://", "")}
                        </a>
                      }
                    />
                    <SettingsDLListItem
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
                    />
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
