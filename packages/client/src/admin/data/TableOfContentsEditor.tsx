import { useContext, useEffect, useState } from "react";
import { Item } from "react-contexify";
import { useParams } from "react-router-dom";
import Button from "../../components/Button";
import { Trans, useTranslation } from "react-i18next";
import Spinner from "../../components/Spinner";
import { MapContext } from "../../dataLayers/MapContextManager";
import TableOfContentsMetadataModal from "../../dataLayers/TableOfContentsMetadataModal";
import TableOfContents, {
  ClientTableOfContentsItem,
  createBoundsRecursive,
  nestItems,
} from "../../dataLayers/tableOfContents/TableOfContents";
import {
  useDeleteBranchMutation,
  useDraftTableOfContentsQuery,
  useLayersAndSourcesForItemsQuery,
  useUpdateTableOfContentsItemChildrenMutation,
} from "../../generated/graphql";
import useLocalStorage from "../../useLocalStorage";
import EditFolderModal from "./EditFolderModal";
import LayerTableOfContentsItemEditor from "./LayerTableOfContentsItemEditor";
import TableOfContentsMetadataEditor from "./TableOfContentsMetadataEditor";
import ZIndexEditor from "./ZIndexEditor";
import PublishTableOfContentsModal from "./PublishTableOfContentsModal";
import useDialog from "../../components/useDialog";
import FolderEditor from "./FolderEditor";

export default function TableOfContentsEditor() {
  const [selectedView, setSelectedView] = useState("tree");
  const { slug } = useParams<{ slug: string }>();
  const { manager } = useContext(MapContext);
  const { t } = useTranslation(["nav"]);

  const tocQuery = useDraftTableOfContentsQuery({
    variables: { slug },
  });
  const [treeItems, setTreeItems] = useState<ClientTableOfContentsItem[]>([]);
  const [openLayerItemId, setOpenLayerItemId] = useState<number>();
  const [createNewFolderModalOpen, setCreateNewFolderModalOpen] =
    useState<boolean>(false);
  const [itemForDeletion, setItemForDeletion] =
    useState<ClientTableOfContentsItem>();
  const [updateChildrenMutation] =
    useUpdateTableOfContentsItemChildrenMutation();
  const [expansionState, setExpansionState] = useLocalStorage<{
    [id: number]: boolean;
  }>("toc-editor-expansion-state", {});
  const [folderId, setFolderId] = useState<number>();
  const [openMetadataItemId, setOpenMetadataItemId] = useState<number>();
  const [openMetadataViewerId, setOpenMetadataViewerId] = useState<number>();
  const [publishOpen, setPublishOpen] = useState(false);
  const [deleteItem] = useDeleteBranchMutation();

  useEffect(() => {
    if (tocQuery.data?.projectBySlug?.draftTableOfContentsItems) {
      setTreeItems(
        nestItems(
          tocQuery.data.projectBySlug.draftTableOfContentsItems,
          expansionState
        )
      );
    } else {
      setTreeItems([]);
    }
  }, [tocQuery.data?.projectBySlug?.draftTableOfContentsItems]);

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
      // @ts-ignore
      manager.reset(sources, layers);
    }
  }, [layersAndSources.data, manager]);

  useEffect(() => {
    tocQuery.refetch();
  }, [slug]);

  const { confirmDelete } = useDialog();

  return (
    <div className="">
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
      <header className="fixed bg-white h-16 w-128 z-20">
        <div className="max-w-md m-auto mt-4">
          <div className="bg-cool-gray-200 w-auto inline-block p-0.5 rounded text-sm">
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
        className="flex-1 overflow-y-auto p-4 pt-16"
        onContextMenu={(e) => e.preventDefault()}
      >
        {tocQuery.loading && <Spinner />}
        {selectedView === "tree" && (
          <TableOfContents
            hideExpandAll={true}
            onMoveNode={async (data) => {
              // let
              const newParentId = data.nextParentNode?.id;
              let children: number[];
              if (
                data.nextParentNode &&
                data.nextParentNode.children &&
                Array.isArray(data.nextParentNode.children)
              ) {
                children = data.nextParentNode.children.map((item) => item.id);
              } else {
                children = data.treeData.map((item) => item.id);
              }
              if (newParentId && !expansionState[newParentId]) {
                setExpansionState((prev) => ({
                  ...prev,
                  [newParentId]: true,
                }));
              }
              await updateChildrenMutation({
                variables: {
                  id: newParentId,
                  childIds: children,
                },
              });
            }}
            canDrag={true}
            onChange={(e) => setTreeItems(e)}
            nodes={treeItems}
            contextMenuId="layers-toc-editor"
            contextMenuItems={[
              <Item
                key="zoom-to"
                hidden={(args) => {
                  return !args.props.item.isFolder && !args.props.item.bounds;
                }}
                className="text-sm hover:bg-primary-500"
                onClick={(args) => {
                  let bounds: [number, number, number, number] | undefined;
                  if (args.props.item.isFolder) {
                    // bounds = null;
                    bounds = createBoundsRecursive(args.props.item);
                  } else {
                    if (args.props.item.bounds) {
                      bounds = args.props.item.bounds.map((coord: string) =>
                        parseFloat(coord)
                      );
                    }
                  }
                  if (
                    bounds &&
                    [180.0, 90.0, -180.0, -90.0].join(",") !== bounds.join(",")
                  ) {
                    manager?.map?.fitBounds(bounds, {
                      padding: 40,
                    });
                  }
                }}
              >
                Zoom To
              </Item>,
              <Item
                key="1"
                className="text-sm"
                onClick={(args) => {
                  if (args.props?.item?.isFolder) {
                    setFolderId(args.props.item.id);
                  } else {
                    if (args.props.item.bounds) {
                      let bounds = args.props.item.bounds.map((coord: string) =>
                        parseFloat(coord)
                      );
                      if (
                        bounds &&
                        [180.0, 90.0, -180.0, -90.0].join(",") !==
                          bounds.join(",")
                      ) {
                        manager?.map?.fitBounds(bounds, {
                          padding: 40,
                        });
                      }
                    }
                    manager?.showLayers([args.props.item.dataLayerId]);
                    setOpenLayerItemId(args.props.item.id);
                  }
                }}
              >
                Edit
              </Item>,
              <Item
                key="2"
                hidden={(args) => args.props?.item?.isFolder}
                className="text-sm"
                onClick={(args) => {
                  setOpenMetadataViewerId(args.props.item.id);
                }}
              >
                Metadata
              </Item>,
              <Item
                key="3"
                hidden={(args) => args.props?.item?.isFolder}
                className="text-sm"
                onClick={(args) => {
                  setOpenMetadataItemId(args.props.item.id);
                }}
              >
                Edit Metadata
              </Item>,
              <Item
                key="4"
                className="text-sm"
                onClick={async (args) => {
                  if (args.props?.item) {
                    await confirmDelete({
                      message: t("Delete Item"),
                      description: t(
                        "Are you sure you want to delete {{name}}?",
                        {
                          name: args.props.item.title.replace(/\.$/, ""),
                        }
                      ),
                      onDelete: async () => {
                        await deleteItem({
                          variables: {
                            id: args.props.item.id as number,
                          },
                        }).then(async () => {
                          await tocQuery.refetch();
                        });
                      },
                    });
                  }
                }}
              >
                Delete
              </Item>,
            ]}
            onVisibilityToggle={(data) => {
              setExpansionState((prev) => {
                return {
                  ...prev,
                  [data.node.id]: data.expanded,
                };
              });
            }}
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
    </div>
  );
}
