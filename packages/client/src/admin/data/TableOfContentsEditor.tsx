import { Suspense, useCallback, useContext, useEffect, useState } from "react";
import { Route, useHistory, useParams } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import Spinner from "../../components/Spinner";
import { MapContext } from "../../dataLayers/MapContextManager";
import {
  useDisableDownloadForSharedLayersMutation,
  useDraftStatusSubscription,
  useDraftTableOfContentsQuery,
  useEnableDownloadForEligibleLayersMutation,
  useExtraTocEditingInfoQuery,
  useLayersAndSourcesForItemsQuery,
  useUpdateTableOfContentsItemChildrenMutation,
} from "../../generated/graphql";
import EditFolderModal from "./EditFolderModal";
import LayerTableOfContentsItemEditor from "./LayerTableOfContentsItemEditor";
import TableOfContentsMetadataEditor from "./TableOfContentsMetadataEditor";
import PublishTableOfContentsModal from "./PublishTableOfContentsModal";
import FolderEditor from "./FolderEditor";
import TreeView, { TreeItem } from "../../components/TreeView";
import { useOverlayState } from "../../components/TreeView";
import { SortingState } from "../../projects/Sketches/TreeItemComponent";
import { OverlayFragment } from "../../generated/queries";
import * as Menubar from "@radix-ui/react-menubar";
import {
  MenuBarContent,
  MenuBarItem,
  MenuBarLabel,
  MenuBarSeparator,
  MenuBarSubmenu,
  MenubarRadioItem,
  MenubarTrigger,
} from "../../components/Menubar";
import bbox from "@turf/bbox";
import { ProjectBackgroundJobContext } from "../uploads/ProjectBackgroundJobContext";
import { Feature } from "geojson";
import { Map } from "mapbox-gl";
import * as Tooltip from "@radix-ui/react-tooltip";
import React from "react";
import { ZIndexEditableList } from "./ZIndexEditableList";
import { LayerEditingContext } from "./LayerEditingContext";
import FullScreenLoadingSpinner from "./FullScreenLoadingSpinner";
import { TableOfContentsItemMenu } from "./TableOfContentsItemMenu";
import * as ContextMenu from "@radix-ui/react-context-menu";
import useOverlaySearchState from "../../dataLayers/useOverlaySearchState";
import SearchResultsMessages from "../../dataLayers/SearchResultsMessages";
import OverlaySearchInput from "../../dataLayers/OverlaySearchInput";
import DataDownloadDefaultSettingModal from "./DataDownloadDefaultSettingModal";
import getSlug from "../../getSlug";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import useDialog from "../../components/useDialog";
import Warning from "../../components/Warning";
import AddMVTUrlModal from "../AddMVTUrlModal";
import AddRemoteGeoJSONModal from "./AddRemoteGeoJSONModal";
import AddGFWSourceModal from "./AddGFWSourceModal";

const LazyArcGISCartModal = React.lazy(
  () =>
    import(
      /* webpackChunkName: "AdminArcGISBrowser" */ "./arcgis/ArcGISCartModal"
    )
);

export default function TableOfContentsEditor() {
  const history = useHistory();
  const { slug } = useParams<{ slug: string }>();

  const setSelectedView = useCallback(
    (view: string) => {
      if (view === "order") {
        // eslint-disable-next-line i18next/no-literal-string
        history.push(`/${slug}/admin/data/zindex`);
      } else {
        // eslint-disable-next-line i18next/no-literal-string
        history.push(`/${slug}/admin/data`);
      }
    },
    [history, slug]
  );

  const selectedView = /zindex/.test(history.location.pathname)
    ? "order"
    : "tree";
  const { manager } = useContext(MapContext);

  const tocQuery = useDraftTableOfContentsQuery({
    variables: { slug },
  });

  const [createNewFolderModalOpen, setCreateNewFolderModalOpen] =
    useState<boolean>(false);
  const [updateChildrenMutation] =
    useUpdateTableOfContentsItemChildrenMutation();
  const [folderId, setFolderId] = useState<number>();
  const [publishOpen, setPublishOpen] = useState(false);
  const mapContext = useContext(MapContext);
  const [arcgisCartOpen, setArcgisCartOpen] = useState(false);
  useDraftStatusSubscription({
    variables: {
      slug,
    },
    shouldResubscribe: true,
  });
  const extraQuery = useExtraTocEditingInfoQuery({
    variables: {
      slug,
    },
  });

  const layerEditingContext = useContext(LayerEditingContext);

  const layersAndSources = useLayersAndSourcesForItemsQuery({
    variables: {
      slug,
      tableOfContentsItemIds:
        tocQuery.data?.projectBySlug?.draftTableOfContentsItems?.map(
          (item) => item.id
        ) || [],
    },
  });

  useEffect(() => {
    const layers = layersAndSources?.data?.projectBySlug?.dataLayersForItems;
    const sources = layersAndSources?.data?.projectBySlug?.dataSourcesForItems;
    if (layers && sources && manager) {
      manager.reset(
        sources,
        layers,
        tocQuery.data?.projectBySlug?.draftTableOfContentsItems || []
      );
    }
  }, [
    layersAndSources.data,
    manager,
    tocQuery.data?.projectBySlug?.draftTableOfContentsItems,
  ]);

  useEffect(() => {
    tocQuery.refetch();
  }, [slug]);

  const {
    expandedIds,
    onExpand,
    setExpandedIds,
    checkedItems,
    onChecked,
    loadingItems,
    overlayErrors,
    treeItems: treeNodes,
    hiddenItems,
    onUnhide,
    hasLocalState,
    resetLocalState,
  } = useOverlayState(
    tocQuery.data?.projectBySlug?.draftTableOfContentsItems,
    true,
    "admin"
  );

  const onSortEnd: (
    draggedTreeItem: TreeItem,
    target: TreeItem,
    state: SortingState
  ) => void = useCallback(
    (draggable, targetTreeItem, state) => {
      const items =
        tocQuery.data?.projectBySlug?.draftTableOfContentsItems || [];
      if (
        state === SortingState.OVER_EXISTING_POSITION ||
        state === SortingState.NONE
      ) {
        return;
      }
      if (state === SortingState.DIRECTLY_OVER_FOLDER) {
        // Stick item at the end of the list of this folder's children
        const folder = items.find(
          (item) => item.stableId === targetTreeItem.id
        );
        const draggedItem = items.find(
          (item) => item.stableId === draggable.id
        );
        if (!folder) {
          throw new Error("Folder not found");
        }
        if (!draggedItem) {
          throw new Error("Dragged item not found");
        }
        const siblings = items
          .filter((item) => item.parentStableId === folder.stableId)
          .sort((a, b) => a.sortIndex - b.sortIndex)
          .map((item) => item.id);
        updateChildrenMutation({
          variables: {
            id: folder.id,
            childIds: [...siblings, draggedItem.id],
          },
          optimisticResponse: (data) => {
            return {
              __typename: "Mutation",
              updateTableOfContentsItemChildren: {
                __typename: "UpdateTableOfContentsItemChildrenPayload",
                tableOfContentsItems: ((data.childIds || []) as number[]).map(
                  (id, sortIndex) => {
                    return {
                      __typename: "TableOfContentsItem",
                      id,
                      sortIndex,
                      parentStableId: folder.stableId || null,
                    };
                  }
                ),
              },
            };
          },
        });
      } else {
        // Position item before or after target sibling, based on LEADING or TRAILING state
        const target = items.find(
          (item) => item.stableId === targetTreeItem.id
        );
        if (!target) {
          throw new Error("Could not find target item");
        }
        const draggedItem = items.find(
          (item) => item.stableId === draggable.id
        );
        if (!draggedItem) {
          throw new Error("Dragged item not found");
        }
        let siblings: OverlayFragment[] = [];
        let parent: OverlayFragment | undefined = undefined;
        if (target.parentStableId) {
          parent = items.find(
            (item) => item.stableId === target.parentStableId
          );
          if (!parent) {
            throw new Error("Could not find parent");
          }
          siblings = items.filter(
            (item) => item.parentStableId === parent!.stableId
          );
        } else {
          siblings = items.filter((item) => !item.parentStableId);
        }
        siblings = siblings
          .filter((item) => item.stableId !== draggedItem.stableId)
          .sort((a, b) => a.sortIndex - b.sortIndex);

        const targetIdx = siblings.findIndex(
          (item) => item.stableId === target.stableId
        );
        if (targetIdx === -1) {
          throw new Error("Could not find index of drag target");
        }
        const children = [
          ...siblings.slice(
            0,
            state === SortingState.TRAILING_EDGE ? targetIdx + 1 : targetIdx
          ),
          draggedItem,
          ...siblings.slice(
            state === SortingState.TRAILING_EDGE ? targetIdx + 1 : targetIdx
          ),
        ];
        updateChildrenMutation({
          variables: {
            id: parent?.id || undefined,
            childIds: children.map((item) => item.id),
          },
          optimisticResponse: (data) => {
            return {
              __typename: "Mutation",
              updateTableOfContentsItemChildren: {
                __typename: "UpdateTableOfContentsItemChildrenPayload",
                tableOfContentsItems: ((data.childIds || []) as number[]).map(
                  (id, sortIndex) => {
                    return {
                      __typename: "TableOfContentsItem",
                      id,
                      sortIndex,
                      parentStableId: parent?.stableId || null,
                    };
                  }
                ),
              },
            };
          },
        });
      }
    },
    [
      tocQuery.data?.projectBySlug?.draftTableOfContentsItems,
      updateChildrenMutation,
    ]
  );

  const {
    search,
    setSearch,
    searchResults,
    filteredTreeNodes,
    searchState,
    isFiltered,
    searching,
  } = useOverlaySearchState({
    isDraft: true,
    projectId: tocQuery.data?.projectBySlug?.id,
    treeNodes,
    expandedIds,
    setExpandedIds,
  });

  return (
    <>
      {createNewFolderModalOpen && (
        <EditFolderModal
          className="z-30"
          folderId={folderId}
          onRequestClose={async (created) => {
            if (created) {
              await tocQuery.refetch();
            }
            setFolderId(undefined);
            setCreateNewFolderModalOpen(false);
          }}
          createNew={createNewFolderModalOpen}
        />
      )}
      {folderId && (
        <FolderEditor
          id={folderId}
          onRequestClose={() => {
            setFolderId(undefined);
          }}
        />
      )}
      {publishOpen && (
        <PublishTableOfContentsModal
          onRequestClose={() => {
            setPublishOpen(false);
            // Hack so that tooltip doesn't reappear after publishing
            document.getElementById("publish-button")?.blur();
            setTimeout(() => {
              document.getElementById("publish-button")?.blur();
            }, 10);
          }}
        />
      )}
      {tocQuery.data?.projectBySlug?.id && (
        <Header
          sharedLayersCount={
            extraQuery.data?.projectBySlug?.downloadableLayersCount || 0
          }
          eligibleLayersCount={
            extraQuery.data?.projectBySlug?.eligableDownloadableLayersCount || 0
          }
          searchLoading={searching}
          search={search}
          onSearchChange={setSearch}
          hasLocalState={hasLocalState}
          resetLocalState={resetLocalState}
          openArcGISCart={() => {
            setArcgisCartOpen(true);
          }}
          onRequestOpenFolder={() => {
            setCreateNewFolderModalOpen(true);
          }}
          map={mapContext.manager?.map}
          region={tocQuery.data?.projectBySlug?.region.geojson}
          selectedView={selectedView}
          setSelectedView={setSelectedView}
          onRequestPublish={() => setPublishOpen(true)}
          publishDisabled={
            tocQuery.data?.projectBySlug?.draftTableOfContentsHasChanges ===
            false
          }
          lastPublished={
            tocQuery.data?.projectBySlug?.tableOfContentsLastPublished
              ? new Date(
                  tocQuery.data.projectBySlug.tableOfContentsLastPublished!
                )
              : undefined
          }
        />
      )}
      {tocQuery.error && (
        <Warning level="error">
          {tocQuery.error.message || "An error occurred"}
        </Warning>
      )}
      <div
        className="flex-1 overflow-y-auto p-2 px-8"
        onContextMenu={(e) => e.preventDefault()}
      >
        {tocQuery.loading && !tocQuery.data?.projectBySlug && <Spinner />}

        <Route exact path={`/${slug}/admin/data`}>
          <>
            <SearchResultsMessages
              filteredTreeNodes={filteredTreeNodes}
              search={search}
              searchResults={searchResults}
            />
            <div
              className={
                "transition-opacity " +
                (searching ? "opacity-50" : "opacity-100")
              }
            >
              <TreeView
                highlights={searchState.highlights}
                disableEditing={isFiltered}
                items={filteredTreeNodes}
                loadingItems={loadingItems}
                errors={overlayErrors}
                expanded={expandedIds}
                onExpand={onExpand}
                checkedItems={checkedItems}
                onChecked={onChecked}
                hiddenItems={hiddenItems}
                onUnhide={onUnhide}
                ariaLabel="Draft overlays"
                sortable={!isFiltered}
                onSortEnd={onSortEnd}
                getContextMenuContent={(treeItemId, clickEvent) => {
                  const item =
                    tocQuery.data?.projectBySlug?.draftTableOfContentsItems?.find(
                      (item) => item.stableId === treeItemId
                    );
                  const sorted =
                    mapContext.manager?.getVisibleLayersByZIndex() || [];
                  if (item) {
                    return (
                      <TableOfContentsItemMenu
                        items={[item]}
                        type={ContextMenu}
                        editable
                        transform={{
                          x: clickEvent.clientX,
                          y: clickEvent.clientY,
                        }}
                        top={sorted[0]?.tocId === item.stableId}
                        bottom={
                          sorted[sorted.length - 1]?.tocId === item.stableId
                        }
                      />
                    );
                  } else {
                    return null;
                  }
                }}
              />
            </div>
          </>
        </Route>
        <Route path={`/${slug}/admin/data/zindex`}>
          <ZIndexEditableList // @ts-ignore
            tableOfContentsItems={
              tocQuery.data?.projectBySlug?.draftTableOfContentsItems
            }
            // @ts-ignore
            dataLayers={
              layersAndSources.data?.projectBySlug?.dataLayersForItems
            }
            // @ts-ignore
            dataSources={
              layersAndSources.data?.projectBySlug?.dataSourcesForItems
            }
          />
        </Route>
      </div>
      {layerEditingContext.openEditor &&
        !layerEditingContext.openEditor.isFolder && (
          <LayerTableOfContentsItemEditor
            onRequestClose={() => layerEditingContext.setOpenEditor(undefined)}
            itemId={layerEditingContext.openEditor.id}
            title={layerEditingContext.openEditor.title}
          />
        )}
      {layerEditingContext.openEditor?.isFolder && (
        <FolderEditor
          id={layerEditingContext.openEditor.id}
          onRequestClose={() => layerEditingContext.setOpenEditor(undefined)}
        />
      )}
      {layerEditingContext.openMetadataEditor && (
        <TableOfContentsMetadataEditor
          id={layerEditingContext.openMetadataEditor}
          onRequestClose={() =>
            layerEditingContext.setOpenMetadataEditor(undefined)
          }
        />
      )}
      {arcgisCartOpen && (
        <Suspense fallback={<FullScreenLoadingSpinner />}>
          <LazyArcGISCartModal
            projectId={tocQuery.data?.projectBySlug?.id as number}
            region={tocQuery.data?.projectBySlug?.region.geojson}
            onRequestClose={() => setArcgisCartOpen(false)}
            importedArcGISServices={
              (extraQuery.data?.projectBySlug?.importedArcgisServices ||
                []) as string[]
            }
          />
        </Suspense>
      )}
    </>
  );
}

function Header({
  selectedView,
  setSelectedView,
  region,
  map,
  onRequestOpenFolder,
  onRequestPublish,
  publishDisabled,
  lastPublished,
  openArcGISCart,
  hasLocalState,
  resetLocalState,
  search,
  onSearchChange,
  searchLoading,
  sharedLayersCount,
  eligibleLayersCount: eligableLayersCount,
}: {
  selectedView: string;
  setSelectedView: (view: string) => void;
  region?: Feature<any>;
  map?: Map;
  onRequestOpenFolder: () => void;
  onRequestPublish: () => void;
  publishDisabled?: boolean;
  lastPublished?: Date;
  openArcGISCart: () => void;
  hasLocalState?: boolean;
  resetLocalState?: () => void;
  onSearchChange?: (search: string) => void;
  search?: string;
  searchLoading?: boolean;
  sharedLayersCount: number;
  eligibleLayersCount: number;
}) {
  const uploadContext = useContext(ProjectBackgroundJobContext);
  const { t } = useTranslation("admin:data");
  const [dataDownloadSettingOpen, setDataDownloadSettingOpen] = useState(false);
  const onError = useGlobalErrorHandler();
  const [enableDownload] = useEnableDownloadForEligibleLayersMutation({
    variables: {
      slug: getSlug(),
    },
    onError,
  });
  const [disableDownload] = useDisableDownloadForSharedLayersMutation({
    variables: {
      slug: getSlug(),
    },
    onError,
  });
  const [mvtUrlModalOpen, setMVTUrlModalOpen] = useState(false);
  const [remoteGeoJSONModalOpen, setRemoteGeoJSONModalOpen] = useState(false);
  const [gfwModalOpen, setGFWModalOpen] = useState(false);

  const { confirm } = useDialog();
  return (
    <header className="w-128 z-20 flex-none border-b shadow-sm bg-gray-100 mt-2 text-sm border-t px-1">
      <Menubar.Root className="flex p-1 py-0.5 rounded-md z-50 items-center">
        <Menubar.Menu>
          <MenubarTrigger>{t("View")}</MenubarTrigger>
          <Menubar.Portal>
            <MenuBarContent>
              <Menubar.RadioGroup
                value={selectedView}
                onValueChange={setSelectedView}
              >
                <MenubarRadioItem value="tree">
                  <Trans ns="admin:data">Table of Contents</Trans>
                </MenubarRadioItem>
                <MenubarRadioItem value="order">
                  <Trans ns="admin:data">Layer Z-Ordering</Trans>
                </MenubarRadioItem>
              </Menubar.RadioGroup>
              <MenuBarSeparator />
              <MenuBarItem
                disabled={!region || !map}
                onClick={() => {
                  if (region && map) {
                    map.fitBounds(
                      bbox(region) as [number, number, number, number],
                      {
                        padding: {
                          top: 20,
                          bottom: 20,
                          left: 150,
                          right: 20,
                        },
                      }
                    );
                  }
                }}
              >
                <Trans ns="admin:data">Zoom to Project Bounds</Trans>
              </MenuBarItem>
              {resetLocalState && (
                <MenuBarItem
                  disabled={!hasLocalState}
                  onClick={() => {
                    resetLocalState();
                  }}
                >
                  <Trans ns="homepage">Reset overlays</Trans>
                </MenuBarItem>
              )}
            </MenuBarContent>
          </Menubar.Portal>
        </Menubar.Menu>
        <Menubar.Menu>
          <MenubarTrigger>{t("Edit")}</MenubarTrigger>
          <Menubar.Portal>
            <MenuBarContent>
              <MenuBarItem onClick={onRequestOpenFolder}>
                <Trans ns="admin:data">Add Folder</Trans>
              </MenuBarItem>
              <MenuBarSubmenu label={t("Add Data")}>
                <MenuBarLabel>{t("Host data on SeaSketch")}</MenuBarLabel>
                <MenuBarItem
                  onClick={() => {
                    const fileInput = document.createElement("input");
                    fileInput.type = "file";
                    fileInput.accept = ".zip,.json,.geojson,.fgb,.tif,.tiff";
                    fileInput.multiple = true;
                    fileInput.onchange = async (e) => {
                      const files = (e.target as HTMLInputElement).files;
                      if (!files) {
                        return;
                      }
                      uploadContext.handleFiles([...files]);
                    };
                    fileInput.click();
                  }}
                >
                  {t("Upload spatial data files")}
                </MenuBarItem>
                <MenuBarSeparator />
                <MenuBarLabel>{t("Connect to data services")}</MenuBarLabel>
                <MenuBarItem
                  onClick={() => {
                    openArcGISCart();
                  }}
                >
                  {t("Esri ArcGIS service...")}
                </MenuBarItem>
                <MenuBarItem
                  onClick={() => {
                    setMVTUrlModalOpen(true);
                  }}
                >
                  {t("Vector tiles by URL...")}
                </MenuBarItem>
                {/* <MenuBarItem
                  onClick={() => {
                    // openArcGISCart();
                  }}
                >
                  {t("TileJSON endpoint...")}
                </MenuBarItem>*/}
                <MenuBarItem
                  onClick={() => {
                    setRemoteGeoJSONModalOpen(true);
                  }}
                >
                  {t("Remote GeoJSON...")}
                </MenuBarItem>
                <MenuBarSeparator />
                <MenuBarLabel>{t("From Authoritative Sources")}</MenuBarLabel>
                <MenuBarItem
                  onClick={() => {
                    setGFWModalOpen(true);
                  }}
                >
                  {t("Global Fishing Watch...")}
                </MenuBarItem>
              </MenuBarSubmenu>
              <MenuBarSeparator />
              <MenuBarLabel>
                <Trans ns="admin:data">Data download</Trans>
              </MenuBarLabel>
              <MenuBarItem
                onClick={async () => {
                  if (
                    await confirm(
                      "Are you sure you want to enable data download for all eligible layers?",
                      {
                        description:
                          "You will need to publish the table of contents for this change to take effect.",

                        onSubmit: async () => {
                          await enableDownload();
                          return;
                        },
                      }
                    )
                  ) {
                  }
                }}
                disabled={eligableLayersCount === 0}
              >
                {t(`Enable for ${eligableLayersCount || ""} eligible layers`)}
              </MenuBarItem>
              <MenuBarItem
                onClick={async () => {
                  if (
                    await confirm(
                      "Are you sure you want to disable data download for all layers?",
                      {
                        description:
                          "You will need to publish the table of contents for this change to take effect.",
                        onSubmit: async () => {
                          await disableDownload();
                          return;
                        },
                      }
                    )
                  ) {
                  }
                }}
                disabled={sharedLayersCount === 0}
              >
                {t(`Disable for ${sharedLayersCount || ""} shared layers`)}
              </MenuBarItem>
            </MenuBarContent>
          </Menubar.Portal>
        </Menubar.Menu>
        <Menubar.Menu>
          <MenubarTrigger>{t("Settings")}</MenubarTrigger>
          <Menubar.Portal>
            <MenuBarContent>
              <Menubar.MenubarGroup>
                <MenuBarItem onClick={() => setDataDownloadSettingOpen(true)}>
                  <Trans ns="admin:data">Data download...</Trans>
                </MenuBarItem>
              </Menubar.MenubarGroup>
            </MenuBarContent>
          </Menubar.Portal>
        </Menubar.Menu>
        <div className="ml-2">
          <OverlaySearchInput
            search={search}
            onChange={onSearchChange}
            loading={searchLoading}
          />
        </div>
        <div className="flex-1 text-right">
          <Tooltip.Provider>
            <Tooltip.Root delayDuration={200}>
              <Tooltip.Trigger asChild>
                <button
                  id="publish-button"
                  className={`${
                    publishDisabled
                      ? "bg-white text-black opacity-80"
                      : "bg-primary-500 text-white"
                  } rounded px-2 py-0.5 mx-1 shadow-sm`}
                  onClick={onRequestPublish}
                >
                  <Trans ns="admin:data">Publish</Trans>
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  style={{ maxWidth: 220 }}
                  className="z-50 select-none rounded bg-white px-4 py-2 shadow text-center"
                  // sideOffset={-200}
                  side="right"
                >
                  {publishDisabled ? (
                    t("No changes")
                  ) : (
                    <span>
                      {t("Has changes since last publish")}
                      {lastPublished
                        ? " on " + lastPublished.toLocaleDateString()
                        : null}
                    </span>
                  )}
                  <Tooltip.Arrow className="" style={{ fill: "white" }} />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>
      </Menubar.Root>
      {dataDownloadSettingOpen && (
        <DataDownloadDefaultSettingModal
          onRequestClose={() => setDataDownloadSettingOpen(false)}
        />
      )}
      {mvtUrlModalOpen && (
        <AddMVTUrlModal onRequestClose={() => setMVTUrlModalOpen(false)} />
      )}
      {remoteGeoJSONModalOpen && (
        <AddRemoteGeoJSONModal
          onRequestClose={() => setRemoteGeoJSONModalOpen(false)}
        />
      )}
      {gfwModalOpen && (
        <AddGFWSourceModal onRequestClose={() => setGFWModalOpen(false)} />
      )}
    </header>
  );
}
