import { useCallback, useContext, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import Spinner from "../../components/Spinner";
import {
  MapContext,
  sourceTypeIsCustomGLSource,
} from "../../dataLayers/MapContextManager";
import TableOfContentsMetadataModal from "../../dataLayers/TableOfContentsMetadataModal";
import {
  DataSourceTypes,
  useDeleteBranchMutation,
  useDraftStatusSubscription,
  useDraftTableOfContentsQuery,
  useLayersAndSourcesForItemsQuery,
  useUpdateTableOfContentsItemChildrenMutation,
} from "../../generated/graphql";
import EditFolderModal from "./EditFolderModal";
import LayerTableOfContentsItemEditor from "./LayerTableOfContentsItemEditor";
import TableOfContentsMetadataEditor from "./TableOfContentsMetadataEditor";
import ZIndexEditor from "./ZIndexEditor";
import PublishTableOfContentsModal from "./PublishTableOfContentsModal";
import useDialog from "../../components/useDialog";
import FolderEditor from "./FolderEditor";
import TreeView, { TreeItem } from "../../components/TreeView";
import { useOverlayState } from "../../components/TreeView";
import { currentSidebarState } from "../../projects/ProjectAppSidebar";
import { DropdownOption } from "../../components/DropdownButton";
import { DropdownDividerProps } from "../../components/ContextMenuDropdown";
import { createBoundsRecursive } from "../../projects/OverlayLayers";
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
import { DataUploadDropzoneContext } from "../uploads/DataUploadDropzone";
import { Feature } from "geojson";
import { Map } from "mapbox-gl";
import * as Tooltip from "@radix-ui/react-tooltip";
import React from "react";
import { CustomGLSource } from "@seasketch/mapbox-gl-esri-sources";

const LazyArcGISCartModal = React.lazy(
  () =>
    import(
      /* webpackChunkName: "AdminArcGISBrowser" */ "./arcgis/ArcGISCartModal"
    )
);

export default function TableOfContentsEditor() {
  const [selectedView, setSelectedView] = useState("tree");
  const { slug } = useParams<{ slug: string }>();
  const { manager } = useContext(MapContext);
  const { t } = useTranslation("nav");

  const tocQuery = useDraftTableOfContentsQuery({
    variables: { slug },
  });
  const [openLayerItemId, setOpenLayerItemId] = useState<number>();
  const [createNewFolderModalOpen, setCreateNewFolderModalOpen] =
    useState<boolean>(false);
  const [updateChildrenMutation] =
    useUpdateTableOfContentsItemChildrenMutation();
  const [folderId, setFolderId] = useState<number>();
  const [openMetadataViewerState, setOpenMetadataViewerState] = useState<
    | undefined
    | {
        itemId: number;
        sublayerId?: string;
        customGLSource?: CustomGLSource<any>;
      }
  >();
  const [openMetadataItemId, setOpenMetadataItemId] = useState<number>();
  const [publishOpen, setPublishOpen] = useState(false);
  const [deleteItem] = useDeleteBranchMutation();
  const mapContext = useContext(MapContext);
  const [arcgisCartOpen, setArcgisCartOpen] = useState(false);
  useDraftStatusSubscription({
    variables: {
      slug,
    },
    shouldResubscribe: true,
  });

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
    checkedItems,
    onChecked,
    loadingItems,
    overlayErrors,
    treeItems: treeNodes,
  } = useOverlayState(
    tocQuery.data?.projectBySlug?.draftTableOfContentsItems || [],
    true,
    "admin"
  );

  const { confirmDelete } = useDialog();

  const getContextMenuItems = useCallback(
    (treeItem: TreeItem) => {
      const items =
        tocQuery.data?.projectBySlug?.draftTableOfContentsItems || [];
      const item = items.find((item) => item.stableId === treeItem.id);
      if (item) {
        const sidebar = currentSidebarState();
        const contextMenuOptions: (DropdownOption | DropdownDividerProps)[] =
          [];
        if (
          !item.isFolder ||
          items.find((i) => i.parentStableId === item.stableId && i.bounds)
        ) {
          contextMenuOptions.push({
            id: "zoom-to",
            label: t("Zoom to bounds"),
            onClick: async () => {
              let bounds: [number, number, number, number] | undefined;
              if (item.isFolder) {
                bounds = createBoundsRecursive(item, items);
              } else {
                if (item.bounds) {
                  bounds = item.bounds.map((coord: string) =>
                    parseFloat(coord)
                  ) as [number, number, number, number];
                } else {
                  const layer =
                    layersAndSources.data?.projectBySlug?.dataLayersForItems?.find(
                      (l) => l.id === item.dataLayerId
                    );
                  if (layer && layer.dataSourceId) {
                    const source =
                      layersAndSources.data?.projectBySlug?.dataSourcesForItems?.find(
                        (s) => s.id === layer.dataSourceId
                      );
                    if (source && sourceTypeIsCustomGLSource(source.type)) {
                      const customSource =
                        mapContext.manager?.getCustomGLSource(source.id);
                      const metadata =
                        await customSource?.getComputedMetadata();
                      if (metadata?.bounds) {
                        bounds = metadata.bounds;
                      }
                    }
                  }
                }
              }
              if (
                bounds &&
                [180.0, 90.0, -180.0, -90.0].join(",") !== bounds.join(",")
              ) {
                mapContext.manager?.map?.fitBounds(bounds, {
                  animate: true,
                  padding: {
                    bottom: 100,
                    top: 100,
                    left: sidebar.open ? sidebar.width + 100 : 100,
                    right: 100,
                  },
                });
              }
            },
          });
        }
        contextMenuOptions.push({
          id: "edit",
          label: t("Edit"),
          onClick: () => {
            if (item?.isFolder) {
              setFolderId(item.id);
            } else {
              if (item.dataLayerId) {
                manager?.showTocItems([item.stableId]);
              }
              setOpenLayerItemId(item.id);
            }
          },
        });
        if (!item.isFolder || item.hideChildren) {
          contextMenuOptions.push({
            id: "metadata",
            label: t("Metadata"),
            onClick: () => {
              const layer =
                layersAndSources.data?.projectBySlug?.dataLayersForItems?.find(
                  (l) => l.id === item.dataLayerId
                );
              const source =
                layersAndSources.data?.projectBySlug?.dataSourcesForItems?.find(
                  (s) => s.id === layer?.dataSourceId
                );
              if (source && sourceTypeIsCustomGLSource(source.type)) {
                const customSource = mapContext.manager?.getCustomGLSource(
                  source.id
                );
                if (customSource) {
                  setOpenMetadataViewerState({
                    itemId: item.id,
                    customGLSource: customSource,
                    sublayerId: layer?.sublayer
                      ? layer.sublayer.toString()
                      : undefined,
                  });
                }
              } else {
                setOpenMetadataViewerState({
                  itemId: item.id,
                });
              }
            },
          });
          if (item.hasMetadata) {
            contextMenuOptions.push({
              id: "edit-metadata",
              label: t("Edit metadata"),
              onClick: () => {
                setOpenMetadataItemId(item.id);
              },
            });
          }
        }
        contextMenuOptions.push({
          id: "delete",
          label: t("Delete"),
          onClick: async () => {
            if (item) {
              await confirmDelete({
                message: t("Delete Item"),
                description: t("Are you sure you want to delete {{name}}?", {
                  name: item.title.replace(/\.$/, ""),
                }),
                onDelete: async () => {
                  await deleteItem({
                    variables: {
                      id: item.id as number,
                    },
                  }).then(async () => {
                    await tocQuery.refetch();
                  });
                },
              });
            }
          },
        });
        return contextMenuOptions;
      } else {
        return [];
      }
    },
    [
      confirmDelete,
      deleteItem,
      manager,
      mapContext.manager,
      t,
      tocQuery,
      layersAndSources.data,
    ]
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
          onRequestClose={() => setPublishOpen(false)}
        />
      )}
      <Header
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
          tocQuery.data?.projectBySlug?.draftTableOfContentsHasChanges === false
        }
        lastPublished={
          tocQuery.data?.projectBySlug?.tableOfContentsLastPublished
            ? new Date(
                tocQuery.data.projectBySlug.tableOfContentsLastPublished!
              )
            : undefined
        }
      />
      <div
        className="flex-1 overflow-y-auto p-2 px-8"
        onContextMenu={(e) => e.preventDefault()}
      >
        {tocQuery.loading && !tocQuery.data?.projectBySlug && <Spinner />}
        {selectedView === "tree" && (
          <TreeView
            loadingItems={loadingItems}
            errors={overlayErrors}
            expanded={expandedIds}
            onExpand={onExpand}
            checkedItems={checkedItems}
            onChecked={onChecked}
            items={treeNodes}
            ariaLabel="Draft overlays"
            sortable
            getContextMenuItems={getContextMenuItems}
            onSortEnd={onSortEnd}
          />
        )}
        {selectedView === "order" && (
          <ZIndexEditor
            // @ts-ignore
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
        )}
      </div>
      {openLayerItemId && (
        <LayerTableOfContentsItemEditor
          onRequestClose={() => setOpenLayerItemId(undefined)}
          itemId={openLayerItemId}
        />
      )}
      {openMetadataItemId && (
        <TableOfContentsMetadataEditor
          id={openMetadataItemId}
          onRequestClose={() => setOpenMetadataItemId(undefined)}
        />
      )}
      {openMetadataViewerState && (
        <TableOfContentsMetadataModal
          id={openMetadataViewerState.itemId}
          customGLSource={openMetadataViewerState.customGLSource}
          onRequestClose={() => setOpenMetadataViewerState(undefined)}
          sublayerId={openMetadataViewerState.sublayerId}
        />
      )}
      {arcgisCartOpen && (
        <LazyArcGISCartModal
          projectId={tocQuery.data?.projectBySlug?.id as number}
          region={tocQuery.data?.projectBySlug?.region.geojson}
          onRequestClose={() => setArcgisCartOpen(false)}
          importedArcGISServices={
            (tocQuery.data?.projectBySlug?.importedArcgisServices ||
              []) as string[]
          }
        />
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
}) {
  const uploadContext = useContext(DataUploadDropzoneContext);
  const { t } = useTranslation("admin:data");

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
                  {t("Esri ArcGIS Service...")}
                </MenuBarItem>
              </MenuBarSubmenu>
            </MenuBarContent>
          </Menubar.Portal>
        </Menubar.Menu>
        <div className="flex-1 text-right">
          <Tooltip.Provider>
            <Tooltip.Root delayDuration={200}>
              <Tooltip.Trigger>
                <button
                  // disabled={Boolean(publishDisabled)}
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
              <Tooltip.Content
                style={{ maxWidth: 220 }}
                className="select-none rounded bg-white px-4 py-2 shadow text-center"
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
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>
      </Menubar.Root>
    </header>
  );
}
