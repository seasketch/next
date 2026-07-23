import { useEffect, useMemo, useState, useCallback, useContext } from "react";
import {
  useGetLayerItemQuery,
  RenderUnderType,
  useUpdateLayerMutation,
  DataSourceTypes,
  OverlayFragment,
} from "../../generated/graphql";
import { useTranslation, Trans } from "react-i18next";
import { MutableRadioGroup } from "../../components/RadioGroup";
import InteractivitySettings from "./InteractivitySettings";
import { gql, useApolloClient } from "@apollo/client";
import useDebounce from "../../useDebounce";
import GLStyleEditor from "./GLStyleEditor/GLStyleEditor";
import { MapManagerContext } from "../../dataLayers/MapContextManager";
import LayerEditorTabs from "./TableOfContentsItemEditor/LayerEditorTabs";
import {
  CaretRightIcon,
  ExclamationTriangleIcon,
} from "@radix-ui/react-icons";
import Skeleton from "../../components/Skeleton";
import FolderIcon from "../../components/FolderIcon";
import OverlayMetataEditor from "./OverlayMetadataEditor";
import useDialog from "../../components/useDialog";
import LayerSettings from "./TableOfContentsItemEditor/LayerSettings";
import { XIcon } from "@heroicons/react/outline";
import LayerVersioning from "./TableOfContentsItemEditor/LayerVersioning";
import DataTablesEditor from "./overlayDataTables/DataTablesEditor";
import { layerSettingsChangeLogRefetchQueries } from "../changelogs/layerSettingsChangeLogRefetch";
import useCurrentProjectMetadata from "../../useCurrentProjectMetadata";

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

  const { manager } = useContext(MapManagerContext);

  const layerChangeLogRefetchQueries = useMemo(
    () => [...layerSettingsChangeLogRefetchQueries(props.itemId)],
    [props.itemId]
  );

  const [mutateLayer, mutateLayerState] = useUpdateLayerMutation({
    refetchQueries: layerChangeLogRefetchQueries,
  });
  const [updateGLStyleMutation, updateGLStyleMutationState] =
    useUpdateLayerMutation({
      refetchQueries: layerChangeLogRefetchQueries,
    });

  const item = data?.tableOfContentsItem;
  const [selectedTab, setSelectedTab] = useState("settings");
  const activeTab = selectedTab;

  useEffect(() => {
    if (item?.stableId && item.dataLayer && manager) {
      manager.showTocItems([item.stableId]);
    }
  }, [item?.stableId, item?.dataLayer, manager]);

  const [style, setStyle] = useState<string>();
  const debouncedStyle = useDebounce(style, 250);

  const client = useApolloClient();
  const layer = item?.dataLayer;
  const source = layer?.dataSource;

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

  const geostats = (source?.geostats?.layers || []).find(
    (l: { layer: string }) => {
      if (!Boolean(layer?.sourceLayer)) {
        return true;
      } else {
        return l.layer === layer?.sourceLayer;
      }
    }
  );

  const { data: projectMeta } = useCurrentProjectMetadata();
  const dataTablesFeatureEnabled = Boolean(
    projectMeta?.project?.featureFlags?.dataTables
  );
  const supportsDataTables = Boolean(geostats) && dataTablesFeatureEnabled;

  const tabs = useMemo(() => {
    const items: {
      id: string;
      name: string;
      title?: string;
      current: boolean;
    }[] = [
      {
        name: t("Settings"),
        id: "settings",
        current: activeTab === "settings",
      },
      {
        name: t("Source"),
        title: t("Data Source"),
        id: "versions",
        current: activeTab === "versions",
      },
      {
        name: t("Style"),
        id: "style",
        current: activeTab === "style",
      },
      {
        name: t("Interact"),
        id: "interactivity",
        current: activeTab === "interactivity",
      },
      {
        name: t("Metadata"),
        id: "metadata",
        current: activeTab === "metadata",
      },
    ];
    if (supportsDataTables) {
      items.push({
        name: t("Tables"),
        title: t("Data Tables"),
        id: "dataTables",
        current: activeTab === "dataTables",
      });
    }
    return items;
  }, [activeTab, supportsDataTables, t]);

  const isArcGISCustomSource =
    source?.type === DataSourceTypes.ArcgisDynamicMapserver ||
    source?.type === DataSourceTypes.ArcgisRasterTiles ||
    source?.type === DataSourceTypes.ArcgisVector;

  return (
    <div
      className="bg-white z-30 absolute bottom-0 w-128 flex flex-col"
      style={{ height: "calc(100vh)" }}
    >
      <div className="flex-0 shrink-0 border-b border-gray-600 bg-gray-700 text-primary-300 shadow-sm">
        <div className="flex items-center gap-2 px-3 pt-3 pb-3">
          <h4 className="min-w-0 flex-1 truncate font-medium text-indigo-100">
            {error ? t("Error") : item?.title || props.title || t("Loading")}
          </h4>
          <button
            type="button"
            aria-label={t("Close layer editor")}
            title={t("Close")}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white border-opacity-5 bg-black bg-opacity-20 text-gray-200 transition-colors hover:border-opacity-10 hover:bg-gray-600 hover:text-white hover:shadow-sm focus:outline-none focus-visible:border-opacity-10 focus-visible:bg-gray-600 focus-visible:text-white focus-visible:shadow-sm focus-visible:ring-2 focus-visible:ring-indigo-300"
            onClick={onRequestClose}
          >
            <XIcon className="pointer-events-none h-5 w-5" aria-hidden />
          </button>
        </div>
        {item?.containedBy && item.containedBy.length > 0 && (
          <div className="px-3 pb-1.5 text-xs text-gray-300">
            <TableOfContentsItemFolderBreadcrumbs
              parents={item.containedBy as OverlayFragment[]}
            />
          </div>
        )}
        <LayerEditorTabs tabs={tabs} onSelect={setSelectedTab} />
      </div>
      {error && (
        <div className="p-4 py-6 space-y-2 text-red-800">
          <p>{t("Failed to load overlay settings.")}</p>
          <p>{error.message}</p>
        </div>
      )}
      {!item && !error && <LoadingSkeleton />}
      {item && activeTab === "settings" && <LayerSettings item={item} />}
      {item && activeTab === "dataTables" && supportsDataTables && (
        <DataTablesEditor item={item} />
      )}
      {item && activeTab === "versions" && <LayerVersioning item={item} />}
      {item && (
        <div
          className={
            activeTab !== "metadata"
              ? "hidden"
              : "flex-1 flex flex-col overflow-y-hidden"
          }
        >
          <OverlayMetataEditor
            id={item.id}
            registerPreventUnload={registerPreventUnload}
          />
        </div>
      )}
      {item &&
        activeTab === "interactivity" &&
        source &&
        source.type === DataSourceTypes.Inaturalist && (
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="bg-gray-50 text-sm border p-4 rounded flex items-center space-x-4 m-4 mt-5">
              <ExclamationTriangleIcon className="h-8 w-8 text-gray-600" />
              <div className="flex-1">
                <Trans ns="admin:data">
                  Interactivity settings are not available for iNaturalist
                  sources.
                </Trans>
              </div>
            </div>
          </div>
        )}
      {item &&
        activeTab === "interactivity" &&
        source &&
        source.type !== DataSourceTypes.Inaturalist && (
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="mt-5">
              {source &&
                layer &&
                source.type !== DataSourceTypes.ArcgisRasterTiles && (
                  <InteractivitySettings
                    id={layer.interactivitySettingsId}
                    dataSourceId={layer.dataSourceId}
                    sublayer={layer.sublayer}
                    geostats={geostats}
                    changeLogRefetchTableOfContentsItemId={item.id}
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

      {item && activeTab === "style" && (
        <div className="h-full overflow-hidden">
          {source && source.type === DataSourceTypes.Inaturalist && (
            <div className="bg-gray-50 text-sm border p-4 rounded flex items-center space-x-4 m-4 mt-5">
              <ExclamationTriangleIcon className="h-8 w-8 text-gray-600" />
              <div className="flex-1">
                <Trans ns="admin:data">
                  Styling is not available for iNaturalist sources, as image
                  tiles displayed as styled by the iNaturalist web service.
                </Trans>
              </div>
            </div>
          )}
          {source &&
            (source.type === DataSourceTypes.Geojson ||
              source.type === DataSourceTypes.SeasketchVector ||
              source.type === DataSourceTypes.SeasketchMvt ||
              source.type === DataSourceTypes.SeasketchRaster ||
              source.type === DataSourceTypes.Vector) && (
              <div className="h-full overflow-hidden flex flex-col">
                {updateGLStyleMutationState.error && (
                  <p className="bg-gray-700 text-red-200 p-2 text-sm">
                    <Trans ns="admin:data">Style save error - </Trans>
                    {updateGLStyleMutationState.error.message}
                  </p>
                )}
                <GLStyleEditor
                  sourceLayer={layer.sourceLayer as string | undefined}
                  layerId={layer.id}
                  tocItemId={item.stableId}
                  tableOfContentsItemId={item.id}
                  geostats={geostats}
                  dataSource={source}
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
                    manager?.updateLegends(true);
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

export function TableOfContentsItemFolderBreadcrumbs({
  parents,
}: {
  parents: { title: string; id: number }[];
}) {
  return (
    <>
      {parents.map((parent) => (
        <span className="inline-flex items-center" key={parent!.id}>
          <CaretRightIcon />
          <FolderIcon />
          <span className="pl-1">{parent?.title}</span>
        </span>
      ))}
    </>
  );
}

function LoadingSkeleton() {
  return (
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
  );
}
