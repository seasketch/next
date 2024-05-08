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
import Tabs, { NonLinkTabItem } from "../../components/Tabs";
import { MapContext } from "../../dataLayers/MapContextManager";
import { CaretRightIcon, ExclamationTriangleIcon } from "@radix-ui/react-icons";
import Skeleton from "../../components/Skeleton";
import FolderIcon from "../../components/FolderIcon";
import OverlayMetataEditor from "./OverlayMetadataEditor";
import useDialog from "../../components/useDialog";
import LayerSettings from "./TableOfContentsItemEditor/LayerSettings";
import { XIcon } from "@heroicons/react/outline";
import LayerVersioning from "./TableOfContentsItemEditor/LayerVersioning";

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

  const [mutateLayer, mutateLayerState] = useUpdateLayerMutation();
  const [updateGLStyleMutation, updateGLStyleMutationState] =
    useUpdateLayerMutation();

  const item = data?.tableOfContentsItem;

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

  const [selectedTab, setSelectedTab] = useState("settings");

  const geostats = (source?.geostats?.layers || []).find(
    (l: { layer: string }) => {
      if (!Boolean(layer?.sourceLayer)) {
        return true;
      } else {
        return l.layer === layer?.sourceLayer;
      }
    }
  );

  const tabs: NonLinkTabItem[] = useMemo(() => {
    return [
      {
        name: "Settings",
        id: "settings",
        current: selectedTab === "settings",
      },
      {
        name: "Data Source",
        id: "versions",
        current: selectedTab === "versions",
      },
      {
        name: "Metadata",
        id: "metadata",
        current: selectedTab === "metadata",
      },
      {
        name: "Style",
        id: "style",
        current: selectedTab === "style",
      },
      {
        name: "Interactivity",
        id: "interactivity",
        current: selectedTab === "interactivity",
      },
    ];
  }, [selectedTab]);

  const isArcGISCustomSource =
    source?.type === DataSourceTypes.ArcgisDynamicMapserver ||
    source?.type === DataSourceTypes.ArcgisRasterTiles ||
    source?.type === DataSourceTypes.ArcgisVector;

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
          <XIcon className="w-5 h-5 text-white" />
        </button>
      </div>
      {item?.containedBy && item.containedBy.length > 0 && (
        <div className="px-4 py-1 bg-gray-700 text-gray-300 text-sm">
          <TableOfContentsItemFolderBreadcrumbs
            parents={item.containedBy as OverlayFragment[]}
          />
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
      {!item && !error && <LoadingSkeleton />}
      {item && selectedTab === "settings" && <LayerSettings item={item} />}
      {item && selectedTab === "versions" && <LayerVersioning item={item} />}
      {item && (
        <div
          className={
            selectedTab !== "metadata"
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
                  geostats={geostats}
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
                  geostats={geostats}
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
