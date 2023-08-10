import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Button from "../../components/Button";
import { useTranslation } from "react-i18next";
import Spinner from "../../components/Spinner";
import { MapContext } from "../../dataLayers/MapContextManager";
import TableOfContentsMetadataModal from "../../dataLayers/TableOfContentsMetadataModal";
import {
  useDeleteBranchMutation,
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
  const [openMetadataItemId, setOpenMetadataItemId] = useState<number>();
  const [openMetadataViewerId, setOpenMetadataViewerId] = useState<number>();
  const [publishOpen, setPublishOpen] = useState(false);
  const [deleteItem] = useDeleteBranchMutation();
  const mapContext = useContext(MapContext);

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
        const contextMenuOptions: (DropdownOption | DropdownDividerProps)[] = [
          {
            id: "zoom-to",
            label: t("Zoom to bounds"),
            onClick: () => {
              let bounds: [number, number, number, number] | undefined;
              if (item.isFolder) {
                bounds = createBoundsRecursive(item, items);
              } else {
                if (item.bounds) {
                  bounds = item.bounds.map((coord: string) =>
                    parseFloat(coord)
                  ) as [number, number, number, number];
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
          },
          {
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
          },
        ];
        if (!item.isFolder || item.hideChildren) {
          contextMenuOptions.push({
            id: "metadata",
            label: t("Metadata"),
            onClick: () => {
              setOpenMetadataViewerId(item.id);
            },
          });
          contextMenuOptions.push({
            id: "edit-metadata",
            label: t("Edit metadata"),
            onClick: () => {
              setOpenMetadataItemId(item.id);
            },
          });
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
    [confirmDelete, deleteItem, manager, mapContext.manager?.map, t, tocQuery]
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
      <header className="bg-white h-14 w-128 z-20 flex-none border-b shadow-sm">
        <div className="mx-auto mt-4 w-auto text-center">
          <div className="bg-cool-gray-200 w-auto inline-block p-0.5 rounded text-sm text-center">
            <span className="px-2">{t("view")}</span>
            <select
              value={selectedView}
              onChange={(e) => setSelectedView(e.target.value)}
              className="bg-white form-select text-sm overflow-visible p-1 px-2 pr-7 border-gray-300 focus:outline-none focus:shadow-outline-blue focus:border-blue-300 rounded-md focus:ring focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5"
              style={{ lineHeight: 1, backgroundSize: "1em 1em" }}
            >
              <option value="tree">{t("Tree Editor")}</option>
              <option value="state">{t("Default Visibility")}</option>
              <option value="order">{t("Z-Order")}</option>
            </select>
          </div>
          {/* <Link
            to={`./data/add-data`}
            className="bg-white rounded shadow-sm border-grey-500 border px-2 py-1 text-sm mx-2"
          >
            Add data
          </Link> */}
          <Button
            small
            label={t("Add data")}
            href={`./data/add-data`}
            className="ml-1"
          />
          <Button
            className="ml-1"
            label={t("Add folder")}
            small
            onClick={async () => {
              setCreateNewFolderModalOpen(true);
            }}
          />
          <Button
            small
            className="ml-1"
            label={t("Publish")}
            onClick={() => setPublishOpen(true)}
          />
        </div>
      </header>
      <div
        className="flex-1 overflow-y-auto p-2 px-8"
        onContextMenu={(e) => e.preventDefault()}
      >
        {tocQuery.loading && <Spinner />}
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
      {openMetadataViewerId && (
        <TableOfContentsMetadataModal
          id={openMetadataViewerId}
          onRequestClose={() => setOpenMetadataViewerId(undefined)}
        />
      )}
    </>
  );
}
